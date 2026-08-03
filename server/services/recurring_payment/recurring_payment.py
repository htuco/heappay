import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from models.recurring_payment import RecurringPayment
from repositories.recurring_payment.recurring_payment import RecurringPaymentRepository
from repositories.transaction.category_rule import CategoryRuleRepository
from repositories.transaction.transaction import TransactionRepository
from schemas.recurring_payment import RecurringPaymentCreate, RecurringPaymentUpdate
from services.transaction.categorisation import recipient_display_name, resolve_auto_category
from settings import get_settings


class RecurringPaymentNotFoundError(Exception):
    """Recurring payment rule does not exist."""


class RecurringPaymentForbiddenError(Exception):
    """User does not own this recurring payment rule."""


class RecurringPaymentCardError(Exception):
    """Sender or recipient card is invalid for this user."""


class RecurringPaymentCategoryError(Exception):
    """Transaction category does not exist."""


def _next_occurrence(
    day_of_month: int,
    from_date: date,
    allowed_months: list[int] | None = None,
) -> date:
    """First date >= from_date on day_of_month in an allowed month.

    Days beyond the month's length are clamped to the last day of that month.
    Iterates forward up to 13 months to find the next valid slot.
    """
    current = from_date.replace(day=1)
    for _ in range(13):
        if allowed_months is None or current.month in allowed_months:
            last_day = calendar.monthrange(current.year, current.month)[1]
            actual_day = min(day_of_month, last_day)
            candidate = date(current.year, current.month, actual_day)
            if candidate >= from_date:
                return candidate
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return from_date


def _advance_one_month(
    current_due: date,
    day_of_month: int,
    allowed_months: list[int] | None = None,
) -> date:
    """Next occurrence strictly after current_due."""
    if current_due.month == 12:
        next_start = date(current_due.year + 1, 1, 1)
    else:
        next_start = date(current_due.year, current_due.month + 1, 1)
    return _next_occurrence(day_of_month, next_start, allowed_months)


class RecurringPaymentService:
    def __init__(
        self,
        repo: RecurringPaymentRepository,
        tx_repo: TransactionRepository,
        category_rule_repo: "CategoryRuleRepository | None" = None,
    ) -> None:
        self._repo = repo
        self._tx_repo = tx_repo
        # Defaulted from the repo's session rather than required, so existing
        # call sites (route, scheduler, tests) construct the service unchanged.
        self._category_rule_repo = category_rule_repo or CategoryRuleRepository(repo._db)

    def _validate_category(self, category_id: int | None) -> None:
        if category_id is not None and not self._tx_repo.transaction_category_exists(category_id):
            raise RecurringPaymentCategoryError()

    def create(self, payload: RecurringPaymentCreate, *, user_id: int) -> RecurringPayment:
        sender_card = self._tx_repo.get_card_for_update(payload.sender_card_id)
        if sender_card is None or sender_card.user_id != user_id:
            raise RecurringPaymentCardError()

        recipient_card = self._tx_repo.get_card_for_update(payload.recipient_card_id)
        if recipient_card is None:
            raise RecurringPaymentCardError()

        self._validate_category(payload.category_id)

        next_due_at = _next_occurrence(payload.day_of_month, date.today(), payload.months)
        return self._repo.create(
            user_id=user_id,
            sender_card_id=payload.sender_card_id,
            recipient_card_id=payload.recipient_card_id,
            amount=payload.amount,
            day_of_month=payload.day_of_month,
            months=payload.months,
            note=payload.note,
            category_id=payload.category_id,
            next_due_at=next_due_at,
        )

    def list_for_user(self, *, user_id: int) -> list[RecurringPayment]:
        return self._repo.list_for_user(user_id)

    def get_by_id_for_user(self, recurring_payment_id: int, *, user_id: int) -> RecurringPayment:
        row = self._repo.get_by_id(recurring_payment_id)
        if row is None:
            raise RecurringPaymentNotFoundError()
        if row.user_id != user_id:
            raise RecurringPaymentForbiddenError()
        return row

    def update(
        self,
        recurring_payment_id: int,
        payload: RecurringPaymentUpdate,
        *,
        user_id: int,
    ) -> RecurringPayment:
        row = self.get_by_id_for_user(recurring_payment_id, user_id=user_id)
        self._validate_category(payload.category_id)
        changes: dict = {}
        if payload.amount is not None:
            changes["amount"] = payload.amount
        if payload.day_of_month is not None:
            changes["day_of_month"] = payload.day_of_month
        if payload.months is not None:
            changes["months"] = ",".join(str(m) for m in payload.months) if payload.months else None
        if "day_of_month" in changes or "months" in changes:
            new_day = changes.get("day_of_month", row.day_of_month)
            new_months = row.months_list if "months" not in changes else payload.months or None
            changes["next_due_at"] = _next_occurrence(new_day, date.today(), new_months)
        if payload.note is not None:
            changes["note"] = payload.note
        # The only field where an explicit `null` is meaningful: it clears the
        # category. Every other field treats `None` as "not provided", so this
        # one has to read the raw request instead of the parsed value.
        if "category_id" in payload.model_fields_set:
            changes["category_id"] = payload.category_id
        if changes:
            row = self._repo.update(row, **changes)
        return row

    def cancel(self, recurring_payment_id: int, *, user_id: int) -> None:
        row = self.get_by_id_for_user(recurring_payment_id, user_id=user_id)
        self._repo.cancel(row)

    def _category_for(self, rule: RecurringPayment, recipient_card) -> int | None:
        """Category to stamp on the transaction this rule generates.

        The rule's own category always wins — keyword rules never override an
        explicit choice, exactly as in `TransactionService.create`. Only when the
        rule carries none do the keyword rules run, so a scheduled "Spotify"
        payment categorises itself the same way the identical manual one does.
        """
        if rule.category_id is not None:
            return rule.category_id
        return resolve_auto_category(
            lambda: self._category_rule_repo.list_applicable(user_id=rule.user_id),
            note=rule.note,
            recipient_name=recipient_display_name(recipient_card),
        )

    def run_due_payments(self) -> dict[str, int]:
        """Called by the scheduler. Creates transactions for all due active rules."""
        settings = get_settings()
        today = date.today()
        due = self._repo.list_due(as_of=today)

        payment_type_id = self._tx_repo.get_transaction_type_id_by_name("payment")
        pending_status_id = self._tx_repo.get_status_id_by_name("pending")

        attempted = created = failed = 0

        for rule in due:
            attempted += 1
            try:
                sender_card = self._tx_repo.get_card_for_update(rule.sender_card_id)
                recipient_card = self._tx_repo.get_card_for_update(rule.recipient_card_id)

                if sender_card is None or recipient_card is None:
                    raise ValueError("Card no longer exists")

                frozen_status_id = self._tx_repo.get_card_status_id_by_name("frozen")
                if frozen_status_id is not None:
                    if sender_card.status_id == frozen_status_id:
                        raise ValueError("Sender card is frozen")
                    if recipient_card.status_id == frozen_status_id:
                        raise ValueError("Recipient card is frozen")

                if sender_card.balance < rule.amount:
                    raise ValueError("Insufficient balance")

                processing_eligible_at = datetime.now(timezone.utc) + timedelta(
                    seconds=settings.tx_min_processing_delay_seconds
                )

                self._tx_repo.create_recurring_transaction(
                    sender_card=sender_card,
                    recipient_card=recipient_card,
                    transaction_type_id=payment_type_id,
                    status_id=pending_status_id,
                    amount=rule.amount,
                    note=rule.note,
                    category_id=self._category_for(rule, recipient_card),
                    processing_eligible_at=processing_eligible_at,
                    recurring_payment_id=rule.recurring_payment_id,
                )
                next_due = _advance_one_month(rule.next_due_at, rule.day_of_month, rule.months_list)
                self._repo.update(rule, next_due_at=next_due, last_run_failed=False, last_run_error=None)
                created += 1
            except Exception as exc:
                next_due = _advance_one_month(rule.next_due_at, rule.day_of_month, rule.months_list)
                self._repo.update(
                    rule,
                    next_due_at=next_due,
                    last_run_failed=True,
                    last_run_error=str(exc)[:255],
                )
                failed += 1

        return {"recurring_attempted": attempted, "recurring_created": created, "recurring_failed": failed}
