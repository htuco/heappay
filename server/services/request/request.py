from models.request import Request
from repositories.request.request import RequestRepository


class RequestNotFoundError(Exception):
    """Request does not exist."""


class TransactionNotFoundError(Exception):
    """Referenced transaction does not exist."""


class ForbiddenError(Exception):
    """User is not authorised to perform this action."""


class NotRefundableError(Exception):
    """Transaction cannot be refunded (not completed, is a deposit, or is not a payment)."""


class RefundAlreadyExistsError(Exception):
    """A refund already exists for this transaction (one is allowed per tx).

    Carries the existing refund's status so the caller can tell the user
    whether it is still pending, was approved, or was declined (final).
    """

    def __init__(self, status: str | None) -> None:
        self.status = status
        super().__init__(f"A refund request already exists ({status}).")


# Backwards-compatible alias — older imports referenced this name.
RefundAlreadyPendingError = RefundAlreadyExistsError


class InsufficientBalanceError(Exception):
    """Recipient card does not have enough balance to reverse the payment."""


class RequestStatusNotFoundError(Exception):
    """Referenced request status does not exist."""


REFUNDABLE_TYPE_NAME = "payment"
COMPLETED_STATUS_NAME = "completed"


class RequestService:
    def __init__(self, repo: RequestRepository) -> None:
        self._repo = repo

    def request_refund(
        self,
        *,
        transaction_id: int,
        note: str | None,
        user_id: int,
    ) -> Request:
        tx = self._repo.get_transaction_by_id(transaction_id)
        if tx is None:
            raise TransactionNotFoundError()

        # deposits (no sender) cannot be refunded
        if tx.sender_card_id is None:
            raise NotRefundableError("Deposits cannot be refunded.")

        # only the sender can request a refund
        owner_id = self._repo.card_owner_id(tx.sender_card_id)
        if owner_id != user_id:
            raise ForbiddenError()

        # only completed transactions are refundable
        completed_id = self._repo.get_transaction_status_id(COMPLETED_STATUS_NAME)
        if tx.status_id != completed_id:
            raise NotRefundableError("Only completed transactions can be refunded.")

        # only one refund per transaction, ever — matches the DB unique
        # constraint, so this pre-check returns a clean 409 instead of letting a
        # duplicate insert escape as an IntegrityError (500). The existing
        # refund's status drives a precise message (pending / approved / declined).
        existing = self._repo.get_any_refund_for_transaction(transaction_id)
        if existing is not None:
            status = self._repo.status_name_for(existing.request_status_id)
            raise RefundAlreadyExistsError(status)

        return self._repo.create_refund_request(
            requester_user_id=user_id,
            transaction_id=transaction_id,
            note=note,
        )

    def approve_refund(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()

        # load original transaction
        detail = request.refund_detail
        if detail is None:
            raise RequestNotFoundError()

        tx = self._repo.get_transaction_by_id(detail.transaction_id)
        if tx is None:
            raise TransactionNotFoundError()

        # check recipient has enough balance to reverse
        recipient_card = self._repo.get_card_for_update(tx.recipient_card_id)
        if recipient_card is None or recipient_card.balance < tx.amount:
            raise InsufficientBalanceError()

        return self._repo.approve_refund(request)

    def decline_refund(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()
        return self._repo.decline_refund(request)

    def list_for_user(
        self, *, user_id: int, limit: int = 50, offset: int = 0
    ) -> tuple[list[Request], int]:
        items = self._repo.list_for_user(user_id=user_id, limit=limit, offset=offset)
        total = self._repo.count_for_user(user_id=user_id)
        return items, total

    def list_pending_refunds(
        self, *, limit: int = 50, offset: int = 0
    ) -> tuple[list[Request], int]:
        items = self._repo.list_pending_refunds(limit=limit, offset=offset)
        total = self._repo.count_pending_refunds()
        return items, total

    def get_pending_refund_for_transaction(self, transaction_id: int) -> Request | None:
        return self._repo.get_pending_refund_for_transaction(transaction_id)

    def list_refunds(
        self, *, limit: int = 50, offset: int = 0, status_id: int | None = None
    ) -> tuple[list[Request], int]:
        if status_id is not None and not self._repo.status_id_exists(status_id):
            raise RequestStatusNotFoundError()
        items = self._repo.list_refunds(limit=limit, offset=offset, status_id=status_id)
        total = self._repo.count_refunds(status_id=status_id)
        return items, total

    def get_refund_stats(self) -> dict[str, int]:
        """Refund-request counts by status, plus a total, for the staff overview."""
        by_status = self._repo.refund_counts_by_status()
        return {
            "pending": by_status.get("pending", 0),
            "approved": by_status.get("approved", 0),
            "declined": by_status.get("declined", 0),
            "cancelled": by_status.get("cancelled", 0),
            "total": sum(by_status.values()),
        }
