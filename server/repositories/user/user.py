from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
from models.contact import Contact
from models.user import User
from models.user_role import UserRole
from models.user_status import UserStatus


UserSearchRow = tuple[User, Card | None, str | None]


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_users(
        self,
        *,
        q: str | None = None,
        email: str | None = None,
        status_id: int | None = None,
        user_role_id: int | None = None,
        include_deleted: bool = False,
        limit: int,
        offset: int,
    ) -> list[User]:
        stmt: Select[tuple[User]] = select(User).order_by(User.user_id)
        if q is not None:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                )
            )
        if email is not None:
            stmt = stmt.where(User.email == email)
        if status_id is not None:
            stmt = stmt.where(User.status_id == status_id)
        if user_role_id is not None:
            stmt = stmt.where(User.user_role_id == user_role_id)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        stmt = stmt.limit(limit).offset(offset)
        return list(self._db.scalars(stmt))

    def get_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id)
        return self._db.scalars(stmt).first()

    def get_by_id_for_update(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id).with_for_update()
        return self._db.scalars(stmt).first()

    def credit_wallet(self, user_id: int, amount: Decimal) -> User:
        """Atomically add *amount* to the user's wallet balance."""
        if amount <= 0:
            raise ValueError("Credit amount must be positive.")
        user = self.get_by_id_for_update(user_id)
        if user is None:
            raise ValueError("User not found for wallet credit.")
        user.wallet_balance = user.wallet_balance + amount
        self._db.commit()
        self._db.refresh(user)
        return user

    def debit_wallet(self, user_id: int, amount: Decimal) -> User:
        """Atomically subtract *amount* from the user's wallet balance."""
        if amount <= 0:
            raise ValueError("Debit amount must be positive.")
        user = self.get_by_id_for_update(user_id)
        if user is None:
            raise ValueError("User not found for wallet debit.")
        if user.wallet_balance < amount:
            raise ValueError("Insufficient wallet balance.")
        user.wallet_balance = user.wallet_balance - amount
        self._db.commit()
        self._db.refresh(user)
        return user

    def transfer_wallet_balance(
        self, *, from_user_id: int, to_user_id: int, amount: Decimal
    ) -> tuple[User, User]:
        """Atomically move *amount* from one user's wallet balance to another's.

        Locks both rows in a fixed order (ascending user_id) rather than
        guardian-then-dependent, so two concurrent transfers between the same
        pair in opposite directions can't deadlock against each other.
        """
        if amount <= 0:
            raise ValueError("Transfer amount must be positive.")
        if from_user_id == to_user_id:
            raise ValueError("Cannot transfer to the same user.")

        first_id, second_id = sorted((from_user_id, to_user_id))
        first = self.get_by_id_for_update(first_id)
        second = self.get_by_id_for_update(second_id)
        from_user = first if first_id == from_user_id else second
        to_user = first if first_id == to_user_id else second
        if from_user is None or to_user is None:
            raise ValueError("User not found for wallet transfer.")
        if from_user.wallet_balance < amount:
            raise ValueError("Insufficient wallet balance.")

        from_user.wallet_balance = from_user.wallet_balance - amount
        to_user.wallet_balance = to_user.wallet_balance + amount
        self._db.commit()
        self._db.refresh(from_user)
        self._db.refresh(to_user)
        return from_user, to_user

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self._db.scalars(stmt).first()

    def search(self, q: str, exclude_user_id: int, limit: int) -> list[UserSearchRow]:
        default_card_id = (
            select(Card.card_id)
            .join(CardStatus, Card.status_id == CardStatus.card_status_id)
            .where(
                Card.user_id == User.user_id,
                Card.deleted_at.is_(None),
                CardStatus.status_name.ilike("active"),
            )
            .order_by(Card.created_at, Card.card_id)
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )
        pattern = f"%{q}%"
        # Non-discoverable users stay hidden from general search, but remain
        # findable by their exact email or if they're already a contact of the
        # searcher — so people can still be paid.
        contact_ids = (
            select(Contact.contact_user_id)
            .where(Contact.owner_user_id == exclude_user_id)
            .scalar_subquery()
        )
        stmt = (
            select(User, Card, CardType.vendor)
            .select_from(User)
            .outerjoin(Card, Card.card_id == default_card_id)
            .outerjoin(CardType, Card.card_type_id == CardType.card_type_id)
            .where(
                User.deleted_at.is_(None),
                User.user_id != exclude_user_id,
                or_(
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    # Full name as one string, so "Talha Zlatar" matches as
                    # readily as either half of it does.
                    (User.first_name + " " + User.last_name).ilike(pattern),
                ),
                or_(
                    User.is_discoverable.is_(True),
                    func.lower(User.email) == q.strip().lower(),
                    User.user_id.in_(contact_ids),
                ),
            )
            .order_by(User.first_name, User.last_name, User.user_id)
            .limit(limit)
        )
        return list(self._db.execute(stmt).all())

    def user_role_exists(self, user_role_id: int) -> bool:
        stmt = select(UserRole.role_id).where(UserRole.role_id == user_role_id)
        return self._db.execute(stmt).scalar_one_or_none() is not None

    def user_status_exists(self, status_id: int) -> bool:
        stmt = select(UserStatus.id).where(UserStatus.id == status_id)
        return self._db.execute(stmt).scalar_one_or_none() is not None

    def create(self, row: User) -> User:
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def save(self, row: User) -> User:
        row.modified_at = datetime.now(timezone.utc)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def soft_delete(self, row: User) -> None:
        now = datetime.now(timezone.utc)
        row.deleted_at = now
        row.modified_at = now
        self._db.commit()

    def total_spent_by_user(self, user_ids: list[int]) -> dict[int, Decimal]:
        """Total money that has actually left each of the given users.

        Lives here rather than in TransactionRepository for the same reason
        has_pending_transaction below does -- the caller is the admin user read
        model, and routing it through the transaction feature would mean
        injecting a second repository into UserService just for one aggregate.

        Definition (deliberate, and worth reading before changing):

        * **Completed only.** Resolved by name, never a hardcoded id. Pending
          money has not been spent yet, and a reversed transaction flips to the
          'reversed' status, so it drops out of this sum on its own.
        * **Outflows only** -- the row must have a sender card. Deposits and
          top-ups have no sender card, so they cannot be mistaken for spend
          even though the user initiated them (initiated_by_user_id means
          "who started this", not "who paid").
        * **Attributed to the spender, not the card owner.** For a shared
          family card the dependent spends from a card the guardian owns, so
          initiated_by_user_id is the only correct answer; it is NULL on rows
          predating that column, hence the fall back to the sender card owner.
        * **Own-account moves excluded.** Shuffling money between two of your
          own cards is not spend.
        * **Gross, not net.** A later refund does not subtract from this
          figure; it is a separate inbound transaction.
        """
        if not user_ids:
            return {}

        from sqlalchemy import case
        from models.transaction import Transaction
        from models.transaction_status import TransactionStatus

        completed_id = self._db.execute(
            select(TransactionStatus.transaction_status_id).where(
                TransactionStatus.name == "completed"
            )
        ).scalar_one_or_none()
        if completed_id is None:
            return {}

        sender_card = aliased(Card)
        recipient_card = aliased(Card)
        spender_id = func.coalesce(Transaction.initiated_by_user_id, sender_card.user_id)

        stmt = (
            select(
                spender_id.label("spender_id"),
                func.coalesce(func.sum(Transaction.amount), Decimal("0")).label("total"),
            )
            .select_from(Transaction)
            .join(sender_card, sender_card.card_id == Transaction.sender_card_id)
            .outerjoin(
                recipient_card, recipient_card.card_id == Transaction.recipient_card_id
            )
            .where(
                Transaction.status_id == completed_id,
                spender_id.in_(user_ids),
                case(
                    (recipient_card.user_id.is_(None), True),
                    else_=recipient_card.user_id != spender_id,
                ),
            )
            .group_by(spender_id)
        )
        return {
            int(row.spender_id): Decimal(row.total)
            for row in self._db.execute(stmt).all()
        }

    def has_pending_transaction(self, user_id: int) -> bool:
        """True if the user has any transaction in the 'pending' status.

        Covers both directions — a transaction this user sent (their card is the
        sender) or received (their card is the recipient) — so a delete cannot
        strand in-flight money. The status is resolved by name, not a hardcoded
        id, since status ids are not stable across environments.
        """
        from sqlalchemy import func
        from models.transaction import Transaction
        from models.transaction_status import TransactionStatus

        pending_id = self._db.execute(
            select(TransactionStatus.transaction_status_id).where(
                TransactionStatus.name == "pending"
            )
        ).scalar_one_or_none()
        if pending_id is None:
            return False

        user_card_ids = select(Card.card_id).where(Card.user_id == user_id)
        stmt = (
            select(func.count())
            .select_from(Transaction)
            .where(
                Transaction.status_id == pending_id,
                or_(
                    Transaction.sender_card_id.in_(user_card_ids),
                    Transaction.recipient_card_id.in_(user_card_ids),
                ),
            )
        )
        return int(self._db.execute(stmt).scalar_one()) > 0
