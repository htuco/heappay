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


class RequestNotPendingError(Exception):
    """The refund request has already been resolved (approved/declined/cancelled).

    Guards against a double approve/decline — e.g. a double-click or two staff
    acting on the same request at once — which would otherwise reverse the
    balances twice.
    """

    def __init__(self, status: str | None) -> None:
        self.status = status
        super().__init__(
            f"This refund request has already been resolved ({status})."
        )


class CardNotFoundError(Exception):
    """Referenced card does not exist."""


class CardAlreadyFrozenError(Exception):
    """The card is already frozen, so a freeze request is pointless."""


class CardNotFrozenError(Exception):
    """The card is not frozen, so an unfreeze request is pointless."""


class FreezeRequestAlreadyPendingError(Exception):
    """A pending freeze request already exists for this card (one at a time)."""


class CardStatusNotFoundError(Exception):
    """The 'frozen' card status is not seeded."""


REFUNDABLE_TYPE_NAME = "payment"
COMPLETED_STATUS_NAME = "completed"
FROZEN_CARD_STATUS_NAME = "frozen"
ACTIVE_CARD_STATUS_NAME = "active"


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

    def get_refund_status(self, transaction_id: int) -> dict[str, object]:
        existing = self._repo.get_any_refund_for_transaction(transaction_id)
        if existing is None:
            return {"exists": False}
        status_name = self._repo.status_name_for(existing.request_status_id)
        return {"exists": True, "request_id": existing.request_id, "status": status_name}

    def approve_refund(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()

        # Lock the request row and confirm it is still pending before touching
        # any balances. This is the guard against a double approve — a
        # double-click or two staff racing — which would otherwise reverse the
        # money twice.
        locked = self._repo.lock_pending_request(request_id)
        if locked is None:
            current = self._repo.status_name_for(request.request_status_id)
            raise RequestNotPendingError(current)
        request = locked

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

        # Same pending guard as approve — a resolved request must not be
        # declined again (it would re-stamp resolved_at and could race an
        # in-flight approve).
        locked = self._repo.lock_pending_request(request_id)
        if locked is None:
            current = self._repo.status_name_for(request.request_status_id)
            raise RequestNotPendingError(current)

        return self._repo.decline_refund(locked)

    # ── card freeze requests ────────────────────────────────────────────────

    def request_card_freeze(
        self,
        *,
        card_id: int,
        note: str | None,
        user_id: int,
    ) -> Request:
        # the card must exist and belong to the requester
        owner_id = self._repo.card_owner_id(card_id)
        if owner_id is None:
            raise CardNotFoundError()
        if owner_id != user_id:
            raise ForbiddenError()

        # already frozen → nothing to request
        card = self._repo.get_card_for_update(card_id)
        frozen_id = self._repo.get_card_status_id_by_name(FROZEN_CARD_STATUS_NAME)
        if frozen_id is None:
            raise CardStatusNotFoundError()
        if card is not None and card.status_id == frozen_id:
            raise CardAlreadyFrozenError()

        # one pending freeze request per card at a time
        existing = self._repo.get_pending_freeze_for_card(card_id)
        if existing is not None:
            raise FreezeRequestAlreadyPendingError()

        return self._repo.create_freeze_request(
            requester_user_id=user_id,
            card_id=card_id,
            note=note,
        )

    def approve_card_freeze(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()

        # Same pending guard as refunds — a resolved request must not re-run the
        # freeze (idempotency against a double approve / two staff racing).
        locked = self._repo.lock_pending_request(request_id)
        if locked is None:
            current = self._repo.status_name_for(request.request_status_id)
            raise RequestNotPendingError(current)
        request = locked

        if request.card_freeze_detail is None:
            raise RequestNotFoundError()

        frozen_id = self._repo.get_card_status_id_by_name(FROZEN_CARD_STATUS_NAME)
        if frozen_id is None:
            raise CardStatusNotFoundError()

        return self._repo.approve_freeze(request, target_status_id=frozen_id)

    def request_card_unfreeze(
        self,
        *,
        card_id: int,
        note: str | None,
        user_id: int,
    ) -> Request:
        owner_id = self._repo.card_owner_id(card_id)
        if owner_id is None:
            raise CardNotFoundError()
        if owner_id != user_id:
            raise ForbiddenError()

        # only a frozen card can be unfrozen
        card = self._repo.get_card_for_update(card_id)
        frozen_id = self._repo.get_card_status_id_by_name(FROZEN_CARD_STATUS_NAME)
        if frozen_id is None:
            raise CardStatusNotFoundError()
        if card is not None and card.status_id != frozen_id:
            raise CardNotFrozenError()

        existing = self._repo.get_pending_freeze_for_card(card_id, type_name="card_unfreeze")
        if existing is not None:
            raise FreezeRequestAlreadyPendingError()

        return self._repo.create_freeze_request(
            requester_user_id=user_id,
            card_id=card_id,
            note=note,
            type_name="card_unfreeze",
        )

    def approve_card_unfreeze(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()

        locked = self._repo.lock_pending_request(request_id)
        if locked is None:
            current = self._repo.status_name_for(request.request_status_id)
            raise RequestNotPendingError(current)
        request = locked

        if request.card_freeze_detail is None:
            raise RequestNotFoundError()

        active_id = self._repo.get_card_status_id_by_name(ACTIVE_CARD_STATUS_NAME)
        if active_id is None:
            raise CardStatusNotFoundError()

        return self._repo.approve_freeze(request, target_status_id=active_id)

    def decline_card_unfreeze(self, *, request_id: int) -> Request:
        return self.decline_card_freeze(request_id=request_id)

    def decline_card_freeze(self, *, request_id: int) -> Request:
        request = self._repo.get_by_id(request_id)
        if request is None:
            raise RequestNotFoundError()

        locked = self._repo.lock_pending_request(request_id)
        if locked is None:
            current = self._repo.status_name_for(request.request_status_id)
            raise RequestNotPendingError(current)

        return self._repo.decline_freeze(locked)

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

    def list_freezes(
        self, *, limit: int = 50, offset: int = 0, status_id: int | None = None
    ) -> tuple[list[Request], int]:
        if status_id is not None and not self._repo.status_id_exists(status_id):
            raise RequestStatusNotFoundError()
        items = self._repo.list_freezes(limit=limit, offset=offset, status_id=status_id)
        total = self._repo.count_freezes(status_id=status_id)
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
