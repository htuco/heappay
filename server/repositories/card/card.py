from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import delete as sa_delete, func, or_, select, update
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
from models.transaction import Transaction
from models.transaction_status import TransactionStatus
from models.transaction_type import TransactionType
from models.user import User

# (Card, User) result tuple alias
CardWithOwner = tuple[Card, User]


class CardRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_all(
        self,
        *,
        user_id: int | None = None,
        status_id: int | None = None,
        card_type_id: int | None = None,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> list[Card]:
        stmt = select(Card)
        if not include_deleted:
            stmt = stmt.where(Card.deleted_at.is_(None))
        if user_id is not None:
            stmt = stmt.where(Card.user_id == user_id)
        if status_id is not None:
            stmt = stmt.where(Card.status_id == status_id)
        if card_type_id is not None:
            stmt = stmt.where(Card.card_type_id == card_type_id)
        stmt = stmt.order_by(Card.card_id).limit(limit).offset(offset)
        return list(self._db.scalars(stmt).all())

    def get_by_id(self, card_id: int, *, include_deleted: bool = False) -> Card | None:
        stmt = select(Card).where(Card.card_id == card_id)
        if not include_deleted:
            stmt = stmt.where(Card.deleted_at.is_(None))
        return self._db.scalars(stmt).first()

    def get_by_id_for_update(self, card_id: int) -> Card | None:
        stmt = (
            select(Card)
            .where(Card.card_id == card_id, Card.deleted_at.is_(None))
            .with_for_update()
        )
        return self._db.scalars(stmt).first()

    def create(
        self,
        *,
        user_id: int,
        status_id: int,
        card_type_id: int,
        card_numb: str,
        last_four: str,
        cvc: str,
        expires_at: date,
        cardholder_name: str | None = None,
        is_main: bool = False,
    ) -> Card:
        if is_main:
            self._db.execute(
                update(Card)
                .where(Card.user_id == user_id, Card.deleted_at.is_(None))
                .values(is_main=False)
                .execution_options(synchronize_session=False)
            )
        row = Card(
            user_id=user_id,
            status_id=status_id,
            card_type_id=card_type_id,
            card_numb=card_numb,
            last_four=last_four,
            cvc=cvc,
            expires_at=expires_at,
            cardholder_name=cardholder_name,
            is_main=is_main,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def update(self, row: Card, changes: dict) -> Card:
        for key, value in changes.items():
            setattr(row, key, value)
        self._db.commit()
        self._db.refresh(row)
        return row

    def soft_delete(self, row: Card) -> None:
        row.deleted_at = datetime.now(timezone.utc)
        self._db.commit()

    def get_oldest_active_card_for_user(
        self, user_id: int, *, exclude_card_id: int
    ) -> Card | None:
        stmt = (
            select(Card)
            .where(
                Card.user_id == user_id,
                Card.card_id != exclude_card_id,
                Card.deleted_at.is_(None),
            )
            .order_by(Card.created_at.asc(), Card.card_id.asc())
            .limit(1)
        )
        return self._db.scalars(stmt).first()

    def transfer_balance(
        self, *, from_card_id: int, to_card_id: int, amount: Decimal
    ) -> None:
        """Atomically move *amount* between two cards owned by the same user."""
        if amount <= 0:
            return
        from_card = self.get_by_id_for_update(from_card_id)
        to_card = self.get_by_id_for_update(to_card_id)
        if from_card is None or to_card is None:
            raise ValueError("Card not found for balance transfer.")
        if from_card.user_id != to_card.user_id:
            raise ValueError("Balance transfer requires cards with the same owner.")
        if from_card.balance < amount:
            raise ValueError("Insufficient balance for sweep.")
        from_card.balance = from_card.balance - amount
        to_card.balance = to_card.balance + amount
        self._db.commit()

    def _get_user_for_update(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id).with_for_update()
        return self._db.scalars(stmt).first()

    def transfer_wallet_to_card(
        self, *, user_id: int, to_card_id: int, amount: Decimal
    ) -> None:
        """Atomically move *amount* from the user's wallet balance onto a card."""
        if amount <= 0:
            return
        user = self._get_user_for_update(user_id)
        to_card = self.get_by_id_for_update(to_card_id)
        if user is None or to_card is None:
            raise ValueError("User or card not found for wallet transfer.")
        if to_card.user_id != user_id:
            raise ValueError("Card is not owned by the wallet's user.")
        if user.wallet_balance < amount:
            raise ValueError("Insufficient wallet balance.")
        user.wallet_balance = user.wallet_balance - amount
        to_card.balance = to_card.balance + amount
        self._db.commit()

    def transfer_card_to_wallet(
        self, *, user_id: int, from_card_id: int, amount: Decimal
    ) -> None:
        """Atomically move *amount* from a card back into the user's wallet balance."""
        if amount <= 0:
            return
        user = self._get_user_for_update(user_id)
        from_card = self.get_by_id_for_update(from_card_id)
        if user is None or from_card is None:
            raise ValueError("User or card not found for wallet transfer.")
        if from_card.user_id != user_id:
            raise ValueError("Card is not owned by the wallet's user.")
        if from_card.balance < amount:
            raise ValueError("Insufficient card balance.")
        from_card.balance = from_card.balance - amount
        user.wallet_balance = user.wallet_balance + amount
        self._db.commit()

    def create_completed_sweep_transaction(
        self,
        *,
        from_card_id: int,
        to_card_id: int,
        amount: Decimal,
    ) -> Transaction:
        """Audit record for balance moved during card expiry (balances already updated)."""
        payment_type_id = self._db.execute(
            select(TransactionType.transaction_type_id).where(
                TransactionType.name == "payment"
            )
        ).scalar_one()
        completed_id = self._db.execute(
            select(TransactionStatus.transaction_status_id).where(
                TransactionStatus.name == "completed"
            )
        ).scalar_one()
        now = datetime.now(timezone.utc)
        row = Transaction(
            sender_card_id=from_card_id,
            recipient_card_id=to_card_id,
            transaction_type_id=payment_type_id,
            status_id=completed_id,
            amount=amount,
            note="Balance transferred from removed card",
            processing_eligible_at=now,
            processed_at=now,
            processed_by="system",
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def restore(self, row: Card) -> Card:
        row.deleted_at = None
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_main_card(self, user_id: int) -> Card | None:
        stmt = (
            select(Card)
            .where(
                Card.user_id == user_id,
                Card.is_main.is_(True),
                Card.deleted_at.is_(None),
            )
        )
        return self._db.scalars(stmt).first()

    def set_main_card(self, user_id: int, card_id: int) -> Card | None:
        card = self.get_by_id(card_id, include_deleted=False)
        if card is None or card.user_id != user_id:
            return None
        self._db.execute(
            update(Card)
            .where(Card.user_id == user_id, Card.deleted_at.is_(None))
            .values(is_main=False)
            .execution_options(synchronize_session=False)
        )
        card.is_main = True
        self._db.commit()
        self._db.refresh(card)
        return card

    def _promote_next_main_card(self, user_id: int) -> None:
        """After the main card is deleted, set is_main on the next-oldest active card."""
        stmt = (
            select(Card)
            .where(Card.user_id == user_id, Card.deleted_at.is_(None))
            .order_by(Card.created_at.asc(), Card.card_id.asc())
            .limit(1)
        )
        next_card = self._db.scalars(stmt).first()
        if next_card:
            next_card.is_main = True
            self._db.commit()

    def lookup_by_card_number(self, card_numb: str) -> "CardWithOwner | None":
        """Return (Card, User) for a non-deleted card matching card_numb, or None."""
        stmt = (
            select(Card, User)
            .join(User, Card.user_id == User.user_id)
            .where(Card.card_numb == card_numb, Card.deleted_at.is_(None))
        )
        return self._db.execute(stmt).first()

    def find_by_card_number_including_deleted(self, card_numb: str) -> Card | None:
        """Return Card matching card_numb regardless of deleted_at, or None."""
        stmt = select(Card).where(Card.card_numb == card_numb)
        return self._db.scalars(stmt).first()

    def resurrect(self, row: Card, *, changes: dict) -> Card:
        """Clear deleted_at and apply provided field updates atomically."""
        if changes.get("is_main") is True:
            self._db.execute(
                update(Card)
                .where(Card.user_id == row.user_id, Card.deleted_at.is_(None))
                .values(is_main=False)
                .execution_options(synchronize_session=False)
            )
        for key, value in changes.items():
            setattr(row, key, value)
        row.deleted_at = None
        self._db.commit()
        self._db.refresh(row)
        return row

    def has_transactions(self, card_id: int) -> bool:
        """True if any transaction references this card on sender or recipient side."""
        stmt = select(Transaction.transaction_id).where(
            or_(
                Transaction.sender_card_id == card_id,
                Transaction.recipient_card_id == card_id,
            )
        ).limit(1)
        return self._db.execute(stmt).first() is not None

    def pending_card_ids_for_user(self, user_id: int) -> set[int]:
        """Set of card_ids (owned by user) that have at least one pending transaction
        on either sender or recipient side."""
        stmt = (
            select(Card.card_id)
            .join(
                Transaction,
                or_(
                    Transaction.sender_card_id == Card.card_id,
                    Transaction.recipient_card_id == Card.card_id,
                ),
            )
            .join(
                TransactionStatus,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(
                Card.user_id == user_id,
                Card.deleted_at.is_(None),
                TransactionStatus.name == "pending",
            )
            .distinct()
        )
        return set(self._db.scalars(stmt).all())

    def pending_freeze_card_ids_for_user(
        self, user_id: int, *, type_name: str = "card_freeze"
    ) -> set[int]:
        """Set of card_ids (owned by user) with a pending freeze/unfreeze request.

        Used to surface a 'Freeze requested' / 'Unfreeze requested' state on the
        card so the user can't queue a second request. Resolves the request
        type/status by name since their ids are not stable across environments.
        """
        from models.card_freeze_request_detail import CardFreezeRequestDetail
        from models.request import Request
        from models.request_status import RequestStatus
        from models.request_type import RequestType

        stmt = (
            select(CardFreezeRequestDetail.card_id)
            .join(Request, Request.request_id == CardFreezeRequestDetail.request_id)
            .join(Card, Card.card_id == CardFreezeRequestDetail.card_id)
            .join(RequestType, Request.request_type_id == RequestType.request_type_id)
            .join(
                RequestStatus,
                Request.request_status_id == RequestStatus.request_status_id,
            )
            .where(
                Card.user_id == user_id,
                Card.deleted_at.is_(None),
                RequestType.name == type_name,
                RequestStatus.name == "pending",
            )
            .distinct()
        )
        return set(self._db.scalars(stmt).all())

    def reserved_by_card_for_user(self, user_id: int) -> dict[int, Decimal]:
        """Per-card reserved (held) amount: sum of pending outgoing transaction
        amounts where one of the user's cards is the sender. Keyed by card_id.

        This is the read-time derivation of escrow holds — funds are debited from
        the sender on create and only released on complete/fail, so a card's
        ``balance`` is already net of these holds (it is Available). Reserved makes
        the in-flight amount visible without changing the balance math.
        """
        stmt = (
            select(
                Card.card_id,
                func.coalesce(func.sum(Transaction.amount), Decimal("0")),
            )
            .join(Transaction, Transaction.sender_card_id == Card.card_id)
            .join(
                TransactionStatus,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(
                Card.user_id == user_id,
                Card.deleted_at.is_(None),
                TransactionStatus.name == "pending",
            )
            .group_by(Card.card_id)
        )
        return {card_id: amount for card_id, amount in self._db.execute(stmt).all()}

    def list_expired_for_soft_delete(self, *, limit: int) -> list[Card]:
        """Non-deleted cards whose expires_at is before today."""
        stmt = (
            select(Card)
            .where(
                Card.deleted_at.is_(None),
                Card.expires_at < func.current_date(),
            )
            .order_by(Card.expires_at.asc(), Card.card_id.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(self._db.scalars(stmt).all())

    def has_pending_transactions(self, card_id: int) -> bool:
        """True if a pending transaction references this card on either side."""
        stmt = (
            select(Transaction.transaction_id)
            .join(
                TransactionStatus,
                Transaction.status_id == TransactionStatus.transaction_status_id,
            )
            .where(
                TransactionStatus.name == "pending",
                or_(
                    Transaction.sender_card_id == card_id,
                    Transaction.recipient_card_id == card_id,
                ),
            )
            .limit(1)
        )
        return self._db.execute(stmt).first() is not None

    def hard_delete(self, row: Card) -> None:
        """Permanently remove a card row from the database."""
        self._db.execute(sa_delete(Card).where(Card.card_id == row.card_id))
        self._db.commit()

    def user_exists(self, user_id: int) -> bool:
        stmt = select(User.user_id).where(User.user_id == user_id)
        return self._db.execute(stmt).first() is not None

    def status_exists(self, status_id: int) -> bool:
        stmt = select(CardStatus.card_status_id).where(
            CardStatus.card_status_id == status_id
        )
        return self._db.execute(stmt).first() is not None

    def get_status_id_by_name(self, name: str) -> int | None:
        stmt = select(CardStatus.card_status_id).where(CardStatus.status_name == name)
        return self._db.execute(stmt).scalar_one_or_none()

    def card_type_exists(self, card_type_id: int) -> bool:
        stmt = select(CardType.card_type_id).where(CardType.card_type_id == card_type_id)
        return self._db.execute(stmt).first() is not None
