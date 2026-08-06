import uuid
from decimal import Decimal

from repositories.user.user import UserRepository


class AllowanceError(Exception):
    """An allowance transfer could not be completed."""


class AllowanceInvalidAmountError(AllowanceError):
    """Transfer amount must be a positive value."""


class AllowanceInsufficientFundsError(AllowanceError):
    """The guardian's wallet does not have enough balance."""


class AllowanceUserNotFoundError(AllowanceError):
    """Guardian or dependent does not exist."""


class AllowanceService:
    """Moves funds from a guardian's own wallet_balance into a dependent's.

    Not a pooled balance — this is a plain transfer between two users' own
    `wallet_balance` scalars, reusing the same row-locked mechanics as
    wallet<->card transfers.
    """

    def __init__(self, user_repo: UserRepository) -> None:
        self._users = user_repo

    def transfer(
        self, *, guardian_user_id: int, dependent_user_id: int, amount: Decimal
    ) -> tuple[Decimal, Decimal]:
        """Returns (guardian_new_balance, dependent_new_balance)."""
        if amount is None or amount <= 0:
            raise AllowanceInvalidAmountError()
        try:
            guardian, dependent = self._users.transfer_wallet_balance(
                from_user_id=guardian_user_id, to_user_id=dependent_user_id, amount=amount
            )
        except ValueError as exc:
            message = str(exc)
            if "Insufficient" in message:
                raise AllowanceInsufficientFundsError() from exc
            raise AllowanceUserNotFoundError() from exc

        self._notify(
            guardian_user_id=guardian_user_id,
            dependent_user_id=dependent_user_id,
            amount=amount,
        )
        return guardian.wallet_balance, dependent.wallet_balance

    def _notify(self, *, guardian_user_id: int, dependent_user_id: int, amount: Decimal) -> None:
        from services.family.family_notification import FamilyNotificationService

        # Each transfer is a distinct event (no ledger row to key off of, and
        # this call is synchronous with no retry path that could double-fire
        # it), so a fresh id per call is correct -- it isn't meant to dedup
        # against anything, just to reuse the same audit-log shape.
        FamilyNotificationService(self._users._db).notify_allowance_received(
            dependent_user_id=dependent_user_id,
            guardian_user_id=guardian_user_id,
            amount=amount,
            reference_id=str(uuid.uuid4()),
        )

