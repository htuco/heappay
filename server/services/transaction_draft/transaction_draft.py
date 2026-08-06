from models.transaction import Transaction
from models.transaction_draft import TransactionDraft
from repositories.family.family_card_member import FamilyCardMemberRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.transaction_draft.transaction_draft import TransactionDraftRepository
from schemas.transaction import TransactionCreate
from schemas.transaction_draft import (
    TransactionDraftCreate,
    TransactionDraftSendRequest,
    TransactionDraftUpdate,
)
from services.transaction.transaction import TransactionService

# Drafts are a convenience, not storage. A cap keeps a runaway client (or a
# user who never cleans up) from turning the list into something unusable.
MAX_DRAFTS_PER_USER = 20

# What a draft is sent as when the user never got as far as picking a type.
DEFAULT_SEND_TYPE = "payment"

# The payment fields a send request may override. Anything not in the request's
# `model_fields_set` falls back to the value stored on the draft.
_OVERRIDABLE_FIELDS = (
    "sender_card_id",
    "recipient_card_id",
    "transaction_type_id",
    "category_id",
    "amount",
    "note",
)


class TransactionDraftNotFoundError(Exception):
    """Draft does not exist."""


class TransactionDraftForbiddenError(Exception):
    """User does not own this draft."""


class TransactionDraftCardError(Exception):
    """Sender or recipient card is missing or not usable by this user."""


class TransactionDraftCategoryError(Exception):
    """Transaction category does not exist."""


class TransactionDraftTypeError(Exception):
    """Transaction type does not exist."""


class TransactionDraftLimitReachedError(Exception):
    """User already has the maximum number of stored drafts."""


class TransactionDraftIncompleteError(Exception):
    """Draft is missing something the send needs (recipient or amount)."""


class TransactionDraftService:
    """Saved-but-not-sent payments.

    Nothing in here touches balances, escrow or the settle path. Saving a draft
    writes one row to its own table; sending one hands the values to
    `TransactionService.create` and lets the ordinary flow do every money
    check it already does. The draft is deleted only once that create has
    returned -- a failed send leaves it exactly where it was, so the user can
    fix the problem and try again.
    """

    def __init__(
        self,
        repo: TransactionDraftRepository,
        tx_repo: TransactionRepository,
        tx_service: TransactionService,
        family_card_member_repo: FamilyCardMemberRepository | None = None,
    ) -> None:
        self._repo = repo
        self._tx_repo = tx_repo
        self._tx_service = tx_service
        self._family_card_member_repo = (
            family_card_member_repo or FamilyCardMemberRepository(repo._db)
        )

    # ── validation ───────────────────────────────────────────────────────────

    def _validate_sender_card(self, card_id: int | None, *, user_id: int) -> None:
        """A draft may only spend from a card the user could actually spend from.

        Same two cases `TransactionService.create` allows: the user's own card,
        or a guardian's card they are an authorized member of. Checking it at
        save time means a draft that saved is a draft that can be sent.
        """
        if card_id is None:
            return
        card = self._repo.get_card(card_id)
        if card is None:
            raise TransactionDraftCardError()
        if card.user_id != user_id and not self._family_card_member_repo.is_member(
            card_id=card_id, dependent_user_id=user_id
        ):
            raise TransactionDraftCardError()

    def _validate_recipient_card(self, card_id: int | None) -> None:
        if card_id is None:
            return
        if self._repo.get_card(card_id) is None:
            raise TransactionDraftCardError()

    def _validate_category(self, category_id: int | None) -> None:
        if category_id is not None and not self._tx_repo.transaction_category_exists(
            category_id
        ):
            raise TransactionDraftCategoryError()

    def _validate_type(self, transaction_type_id: int | None) -> None:
        if transaction_type_id is not None and not self._tx_repo.transaction_type_exists(
            transaction_type_id
        ):
            raise TransactionDraftTypeError()

    def _validate_references(self, payload, *, user_id: int) -> None:
        self._validate_sender_card(payload.sender_card_id, user_id=user_id)
        self._validate_recipient_card(payload.recipient_card_id)
        self._validate_category(payload.category_id)
        self._validate_type(payload.transaction_type_id)

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def create(
        self, payload: TransactionDraftCreate, *, user_id: int
    ) -> TransactionDraft:
        if self._repo.count_for_user(user_id) >= MAX_DRAFTS_PER_USER:
            raise TransactionDraftLimitReachedError()
        self._validate_references(payload, user_id=user_id)
        return self._repo.create(
            user_id=user_id,
            sender_card_id=payload.sender_card_id,
            recipient_card_id=payload.recipient_card_id,
            transaction_type_id=payload.transaction_type_id,
            category_id=payload.category_id,
            amount=payload.amount,
            note=payload.note,
        )

    def list_for_user(self, *, user_id: int) -> list[TransactionDraft]:
        return self._repo.list_for_user(user_id)

    def get_by_id_for_user(self, draft_id: int, *, user_id: int) -> TransactionDraft:
        row = self._repo.get_by_id(draft_id)
        if row is None:
            raise TransactionDraftNotFoundError()
        if row.user_id != user_id:
            raise TransactionDraftForbiddenError()
        return row

    def update(
        self, draft_id: int, payload: TransactionDraftUpdate, *, user_id: int
    ) -> TransactionDraft:
        row = self.get_by_id_for_user(draft_id, user_id=user_id)
        self._validate_references(payload, user_id=user_id)
        # Every field is nullable, so `None` alone can't say whether the client
        # meant "clear it" or "I didn't send it". `model_fields_set` can.
        changes = {
            field: getattr(payload, field)
            for field in _OVERRIDABLE_FIELDS
            if field in payload.model_fields_set
        }
        if not changes:
            return row
        return self._repo.update(row, **changes)

    def delete(self, draft_id: int, *, user_id: int) -> None:
        row = self.get_by_id_for_user(draft_id, user_id=user_id)
        self._repo.delete(row)

    # ── send ─────────────────────────────────────────────────────────────────

    def send(
        self, draft_id: int, payload: TransactionDraftSendRequest, *, user_id: int
    ) -> tuple[Transaction, bool]:
        """Turn a draft into a real transaction, then consume it.

        Everything money-related -- duplicate window, frozen cards, balance,
        step-up verification, spending limits, apply-on-settle -- happens inside
        `TransactionService.create`, unchanged. If it raises, the exception
        travels up untouched and the draft is still there.
        """
        row = self.get_by_id_for_user(draft_id, user_id=user_id)

        merged = {
            field: (
                getattr(payload, field)
                if field in payload.model_fields_set
                else getattr(row, field)
            )
            for field in _OVERRIDABLE_FIELDS
        }

        if merged["recipient_card_id"] is None:
            raise TransactionDraftIncompleteError("This draft needs a recipient.")
        if merged["amount"] is None:
            raise TransactionDraftIncompleteError("This draft needs an amount.")

        if merged["transaction_type_id"] is None:
            merged["transaction_type_id"] = self._tx_repo.get_transaction_type_id_by_name(
                DEFAULT_SEND_TYPE
            )

        try:
            create_payload = TransactionCreate(
                **merged,
                idempotency_key=payload.idempotency_key,
                requires_approval=payload.requires_approval,
                biometric=payload.biometric,
                app_pin=payload.app_pin,
                totp_code=payload.totp_code,
                password=payload.password,
            )
        except ValueError as exc:
            raise TransactionDraftIncompleteError(str(exc)) from None

        transaction, created = self._tx_service.create(create_payload, user_id=user_id)

        # Only reached when create succeeded; anything it raised skipped this.
        self._repo.delete(row)
        return transaction, created
