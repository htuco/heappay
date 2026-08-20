from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import AliasPath, BaseModel, ConfigDict, Field, computed_field, model_validator

from schemas.money import MoneyAmount


class BiometricApprovalAssertion(BaseModel):
    challenge_id: int
    credential: dict[str, Any]


class BiometricApprovalOptionsResponse(BaseModel):
    challenge_id: int
    public_key: dict[str, Any] = Field(alias="publicKey")


class TransactionCreate(BaseModel):
    sender_card_id: int | None = Field(default=None, gt=0)
    recipient_card_id: int = Field(gt=0)
    transaction_type_id: int = Field(gt=0)
    category_id: int | None = Field(default=None, gt=0)
    amount: MoneyAmount
    note: str | None = Field(default=None, max_length=255)
    idempotency_key: str | None = Field(default=None, min_length=1, max_length=128)
    requires_approval: bool = False
    biometric: BiometricApprovalAssertion | None = None
    app_pin: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")
    totp_code: str | None = Field(default=None, min_length=6, max_length=6)
    password: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_create_request(self) -> "TransactionCreate":
        if (
            self.sender_card_id is not None
            and self.sender_card_id == self.recipient_card_id
        ):
            raise ValueError("sender_card_id must differ from recipient_card_id")
        credentials = [self.biometric, self.app_pin, self.totp_code, self.password]
        provided = [credential for credential in credentials if credential]
        if len(provided) > 1:
            raise ValueError("Provide only one payment confirmation method.")
        return self


class TransactionPatch(BaseModel):
    status_id: int | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=255)
    # category_id is metadata only — setting/clearing it must not touch status,
    # balances, or the settle flow. Omitted => untouched (exclude_unset); an
    # explicit null clears the category back to "Uncategorised". gt=0 rejects 0
    # while still allowing null through.
    category_id: int | None = Field(default=None, gt=0)


class TransactionApproveRequest(BaseModel):
    """Step-up verification before settling a sensitive pending payment."""

    totp_code: str | None = Field(default=None, min_length=6, max_length=6)
    password: str | None = Field(default=None, min_length=1, max_length=255)
    biometric: BiometricApprovalAssertion | None = None
    app_pin: str | None = Field(default=None, min_length=4, max_length=4, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def require_one_credential(self) -> "TransactionApproveRequest":
        credentials = [self.totp_code, self.password, self.biometric, self.app_pin]
        provided = [credential for credential in credentials if credential]
        if not provided:
            raise ValueError("Provide a verification method for step-up verification.")
        if len(provided) > 1:
            raise ValueError("Provide only one verification method.")
        return self


class PaymentApprovalEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    transaction_id: int
    event_type: str
    actor_user_id: int | None = None
    verification_method: str | None = None
    detail: str | None = None
    created_at: datetime


class TransactionSummaryPoint(BaseModel):
    period: str  # "YYYY-MM"
    income: Decimal
    expense: Decimal

    @computed_field  # type: ignore[prop-decorator]
    @property
    def net(self) -> Decimal:
        return self.income - self.expense


class TransactionSummaryResponse(BaseModel):
    points: list[TransactionSummaryPoint]
    months: int


class CategoryBreakdownItem(BaseModel):
    # category_id is null for the "Uncategorised" bucket so the chart reconciles
    # to total outgoing spend.
    category_id: int | None
    name: str
    total: Decimal
    count: int


class CategoryBreakdownResponse(BaseModel):
    items: list[CategoryBreakdownItem]
    months: int


class CategoryTimeseriesSeries(BaseModel):
    # One line per category. `points` is aligned position-for-position with the
    # response's `periods` list (0 for a month with no spend in that category),
    # so the client can plot without re-bucketing. category_id is null for the
    # Uncategorised bucket, matching CategoryBreakdownItem.
    category_id: int | None
    name: str
    total: Decimal
    points: list[Decimal]


class CategoryTimeseriesResponse(BaseModel):
    # `periods` are chronological "YYYY-MM" labels spanning the selected range;
    # `range` echoes the requested window (7d | 30d | 90d | 1y).
    range: str
    periods: list[str]
    series: list[CategoryTimeseriesSeries]


class TransactionStatsMonthlyPoint(BaseModel):
    period: str  # "YYYY-MM"
    count: int
    volume: Decimal | None = None
    volume_hidden: bool = False


class TransactionStatsResponse(BaseModel):
    monthly: list[TransactionStatsMonthlyPoint]
    by_status: dict[str, int]
    by_type: dict[str, int]
    total_count: int
    completed_volume: Decimal | None = None
    months: int
    amounts_hidden: bool = False


class TransactionPartyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    card_id: int
    user_id: int
    last_four: str | None
    brand: str | None = Field(default=None, validation_alias=AliasPath("card_type", "vendor"))
    cardholder_name: str | None
    email: str | None = Field(default=None, validation_alias=AliasPath("user", "email"))
    avatar_url: str | None = Field(default=None, validation_alias=AliasPath("user", "avatar_url"))
    first_name: str | None = Field(
        default=None, validation_alias=AliasPath("user", "first_name")
    )
    last_name: str | None = Field(
        default=None, validation_alias=AliasPath("user", "last_name")
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def full_name(self) -> str | None:
        value = " ".join(part for part in [self.first_name, self.last_name] if part).strip()
        return value or self.cardholder_name or None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    sender_card_id: int | None
    recipient_card_id: int
    recurring_payment_id: int | None = None
    transaction_type_id: int
    status_id: int
    category_id: int | None = None
    amount: Decimal | None = None
    amount_hidden: bool = False
    note: str | None
    created_at: datetime
    processing_eligible_at: datetime
    processed_at: datetime | None = None
    processed_by: str | None = None
    deny_reason_code: str | None = None
    requires_user_approval: bool = False
    user_approval_expires_at: datetime | None = None
    user_approved_at: datetime | None = None
    user_approval_method: str | None = None
    awaiting_user_approval: bool = False
    has_pending_refund: bool = False
    # Name of the existing refund request's status for this transaction, if any
    # (pending | approved | declined | cancelled). None when no refund exists.
    # Because a transaction can have at most one refund ever
    # (uq_refund_request_per_transaction), this is unambiguous and lets the
    # client pre-check the refund modal: disable "Submit request" and show a
    # status label (esp. declined = final) without a second round-trip.
    refund_status: str | None = None
    sender: TransactionPartyResponse | None = Field(
        default=None, validation_alias=AliasPath("sender_card")
    )
    recipient: TransactionPartyResponse = Field(validation_alias=AliasPath("recipient_card"))

    @model_validator(mode="before")
    @classmethod
    def populate_refund_fields(cls, values):
        detail = getattr(values, "refund_detail", None)
        if detail is not None:
            request = getattr(detail, "request", None)
            if request is not None:
                if getattr(request, "request_status_id", None) == 1:
                    values.__dict__["has_pending_refund"] = True
                status = getattr(request, "request_status", None)
                status_name = getattr(status, "name", None)
                if status_name is not None:
                    values.__dict__["refund_status"] = status_name

        requires = getattr(values, "requires_user_approval", False)
        approved_at = getattr(values, "user_approved_at", None)
        status_id = getattr(values, "status_id", None)
        if requires and approved_at is None and status_id == 1:
            values.__dict__["awaiting_user_approval"] = True
        return values
