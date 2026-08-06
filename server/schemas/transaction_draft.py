from datetime import datetime
from decimal import Decimal

from pydantic import AliasPath, BaseModel, ConfigDict, Field, computed_field, model_validator

from schemas.money import MoneyAmount
from schemas.transaction import BiometricApprovalAssertion


class TransactionDraftCreate(BaseModel):
    """Everything is optional: a draft is a half-finished payment by design.

    The only rule enforced here is the one that would be nonsense in any state
    -- paying a card from itself. Everything else (a recipient exists, the
    amount is valid, the sender can afford it) is checked when the draft is
    sent, by the ordinary transaction create path.
    """

    sender_card_id: int | None = Field(default=None, gt=0)
    recipient_card_id: int | None = Field(default=None, gt=0)
    transaction_type_id: int | None = Field(default=None, gt=0)
    category_id: int | None = Field(default=None, gt=0)
    amount: MoneyAmount | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_cards_distinct(self) -> "TransactionDraftCreate":
        if (
            self.sender_card_id is not None
            and self.sender_card_id == self.recipient_card_id
        ):
            raise ValueError("sender_card_id must differ from recipient_card_id")
        return self


class TransactionDraftUpdate(TransactionDraftCreate):
    """Same shape as create, but omitted keys mean "leave alone".

    Every field is nullable, so `None` is ambiguous on its own -- the service
    reads `model_fields_set` to tell "clear this" from "don't touch this".
    """


class TransactionDraftSendRequest(BaseModel):
    """Send a saved draft through the normal transaction create path.

    The payment fields are optional overrides: anything omitted falls back to
    what the draft stored, so the drafts list can send with credentials alone
    while the wizard can send the values the user just edited. The credential
    fields mirror `TransactionCreate` because step-up verification is the same
    check either way -- this endpoint hands them straight to
    `TransactionService.create`.
    """

    sender_card_id: int | None = Field(default=None, gt=0)
    recipient_card_id: int | None = Field(default=None, gt=0)
    transaction_type_id: int | None = Field(default=None, gt=0)
    category_id: int | None = Field(default=None, gt=0)
    amount: MoneyAmount | None = Field(default=None)
    note: str | None = Field(default=None, max_length=255)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=128)
    requires_approval: bool = False
    biometric: BiometricApprovalAssertion | None = None
    app_pin: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")
    totp_code: str | None = Field(default=None, min_length=6, max_length=6)
    password: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_single_credential(self) -> "TransactionDraftSendRequest":
        credentials = [self.biometric, self.app_pin, self.totp_code, self.password]
        provided = [credential for credential in credentials if credential]
        if len(provided) > 1:
            raise ValueError("Provide only one payment confirmation method.")
        return self


class TransactionDraftPartyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    card_id: int
    last_four: str | None
    cardholder_name: str | None
    brand: str | None = Field(default=None, validation_alias=AliasPath("card_type", "vendor"))
    user_id: int | None = Field(default=None, validation_alias=AliasPath("user", "user_id"))
    email: str | None = Field(default=None, validation_alias=AliasPath("user", "email"))
    first_name: str | None = Field(default=None, validation_alias=AliasPath("user", "first_name"))
    last_name: str | None = Field(default=None, validation_alias=AliasPath("user", "last_name"))
    avatar_url: str | None = Field(default=None, validation_alias=AliasPath("user", "avatar_url"))


class TransactionDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    draft_id: int
    user_id: int
    sender_card_id: int | None
    recipient_card_id: int | None
    transaction_type_id: int | None
    category_id: int | None
    amount: Decimal | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    sender: TransactionDraftPartyResponse | None = Field(
        default=None, validation_alias=AliasPath("sender_card")
    )
    recipient: TransactionDraftPartyResponse | None = Field(
        default=None, validation_alias=AliasPath("recipient_card")
    )

    @computed_field
    @property
    def is_sendable(self) -> bool:
        """Whether this draft has enough filled in to attempt a send.

        Only the fields the draft itself can be missing -- the transaction type
        falls back to "payment" at send time, and everything money-related
        (balance, frozen cards, limits) is the create path's business, not a
        property of the draft.
        """
        return self.recipient_card_id is not None and self.amount is not None
