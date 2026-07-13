from decimal import Decimal

from models.user import User
from repositories.card.card import CardRepository
from repositories.user.user import UserRepository


class WalletUserNotFoundError(Exception):
    """User does not exist."""


class WalletCardNotFoundError(Exception):
    """Card does not exist."""


class WalletCardNotOwnedError(Exception):
    """Card does not belong to the requesting user."""


class WalletCardFrozenError(Exception):
    """A frozen card cannot move money to or from the wallet."""


class WalletInsufficientFundsError(Exception):
    """The source (wallet or card) does not have enough balance."""


class WalletInvalidAmountError(Exception):
    """Transfer amount must be a positive value."""


FROZEN_CARD_STATUS = "frozen"


class WalletService:
    """Moves funds between a user's wallet balance and their cards.

    The wallet is a holding pool of unallocated funds. Cards remain the only
    instrument that can spend money, so this service only shuttles balance
    between the two — it never touches the card-to-card payment ledger.
    """

    def __init__(self, user_repo: UserRepository, card_repo: CardRepository) -> None:
        self._users = user_repo
        self._cards = card_repo

    def get_balance(self, user_id: int) -> Decimal:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise WalletUserNotFoundError()
        return user.wallet_balance

    def transfer_to_card(self, *, user_id: int, card_id: int, amount: Decimal) -> User:
        """Move *amount* from the wallet onto a card."""
        self._validate_amount(amount)
        self._guard_card(user_id=user_id, card_id=card_id)
        try:
            self._cards.transfer_wallet_to_card(
                user_id=user_id, to_card_id=card_id, amount=amount
            )
        except ValueError as exc:
            raise WalletInsufficientFundsError() from exc
        return self._require_user(user_id)

    def transfer_to_wallet(self, *, user_id: int, card_id: int, amount: Decimal) -> User:
        """Move *amount* from a card back into the wallet."""
        self._validate_amount(amount)
        self._guard_card(user_id=user_id, card_id=card_id)
        try:
            self._cards.transfer_card_to_wallet(
                user_id=user_id, from_card_id=card_id, amount=amount
            )
        except ValueError as exc:
            raise WalletInsufficientFundsError() from exc
        return self._require_user(user_id)

    def _validate_amount(self, amount: Decimal) -> None:
        if amount is None or amount <= 0:
            raise WalletInvalidAmountError()

    def _guard_card(self, *, user_id: int, card_id: int) -> None:
        card = self._cards.get_by_id(card_id)
        if card is None:
            raise WalletCardNotFoundError()
        if card.user_id != user_id:
            raise WalletCardNotOwnedError()
        frozen_status_id = self._cards.get_status_id_by_name(FROZEN_CARD_STATUS)
        if frozen_status_id is not None and card.status_id == frozen_status_id:
            raise WalletCardFrozenError()

    def _require_user(self, user_id: int) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise WalletUserNotFoundError()
        return user
