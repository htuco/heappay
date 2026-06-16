from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from models.card import Card
from models.user import User
from repositories.card.card import CardRepository
from schemas.card import CardCreate, CardPatch


class CardNotFoundError(Exception):
    """Card does not exist."""


class UserNotFoundError(Exception):
    """User does not exist."""


class CardStatusNotFoundError(Exception):
    """Card status does not exist."""


class CardTypeNotFoundError(Exception):
    """Card type does not exist."""


class DuplicateCardNumberError(Exception):
    """A card with this number is already registered."""


class CardDoesNotBelongToUserError(Exception):
    """Card does not belong to the requesting user."""


class CardBelongsToAnotherAccountError(Exception):
    """A soft-deleted card with this number is owned by another user."""


class CardHasTransactionsError(Exception):
    """Card cannot be hard-deleted because transactions reference it."""


class CardHasPendingTransactionsError(Exception):
    """Card cannot be removed because a pending transaction references it."""


class NoSweepDestinationError(Exception):
    """Expired card has a balance but no other active card to receive it."""


class CardService:
    def __init__(self, repo: CardRepository) -> None:
        self._repo = repo

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
        return self._repo.list_all(
            user_id=user_id,
            status_id=status_id,
            card_type_id=card_type_id,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
        )

    def get_by_id(self, card_id: int) -> Card | None:
        return self._repo.get_by_id(card_id, include_deleted=False)

    def set_status_by_name(self, card_id: int, status_name: str) -> Card:
        """Set a card's status by resolving the status id by name.

        Status ids are not stable across environments, so callers (block/unblock)
        must never hardcode a numeric id.
        """
        status_id = self._repo.get_status_id_by_name(status_name)
        if status_id is None:
            raise CardStatusNotFoundError()
        return self.patch(card_id, CardPatch(status_id=status_id))

    def pending_card_ids_for_user(self, user_id: int) -> set[int]:
        return self._repo.pending_card_ids_for_user(user_id)

    def reserved_by_card_for_user(self, user_id: int) -> dict[int, Decimal]:
        """Per-card reserved (held) amount for the user's cards, keyed by card_id."""
        return self._repo.reserved_by_card_for_user(user_id)

    def pending_freeze_card_ids_for_user(self, user_id: int) -> set[int]:
        """Card ids owned by the user that have a pending freeze request."""
        return self._repo.pending_freeze_card_ids_for_user(user_id)

    def pending_unfreeze_card_ids_for_user(self, user_id: int) -> set[int]:
        """Card ids owned by the user that have a pending unfreeze request."""
        return self._repo.pending_freeze_card_ids_for_user(user_id, type_name="card_unfreeze")

    def get_by_id_including_deleted(self, card_id: int) -> Card | None:
        return self._repo.get_by_id(card_id, include_deleted=True)

    def create(self, payload: CardCreate) -> Card:
        self._validate_fk(
            user_id=payload.user_id,
            status_id=payload.status_id,
            card_type_id=payload.card_type_id,
        )

        existing = self._repo.find_by_card_number_including_deleted(payload.card_numb)
        if existing is not None:
            if existing.deleted_at is None:
                raise DuplicateCardNumberError()
            if existing.user_id != payload.user_id:
                raise CardBelongsToAnotherAccountError()
            return self._repo.resurrect(
                existing,
                changes={
                    "status_id": payload.status_id,
                    "card_type_id": payload.card_type_id,
                    "cvc": payload.cvc,
                    "expires_at": payload.expires_at,
                    "cardholder_name": payload.cardholder_name,
                    "is_main": payload.is_main,
                },
            )

        try:
            return self._repo.create(
                user_id=payload.user_id,
                status_id=payload.status_id,
                card_type_id=payload.card_type_id,
                card_numb=payload.card_numb,
                last_four=payload.card_numb[-4:],
                cvc=payload.cvc,
                expires_at=payload.expires_at,
                cardholder_name=payload.cardholder_name,
                is_main=payload.is_main,
            )
        except IntegrityError as exc:
            if "uq_cards_card_numb" in str(exc.orig).lower() or "card_numb" in str(exc.orig).lower():
                raise DuplicateCardNumberError() from exc
            raise

    def patch(self, card_id: int, payload: CardPatch) -> Card:
        row = self._repo.get_by_id(card_id, include_deleted=False)
        if row is None:
            raise CardNotFoundError()

        changes = payload.model_dump(exclude_unset=True)
        if "user_id" in changes and not self._repo.user_exists(changes["user_id"]):
            raise UserNotFoundError()
        if "status_id" in changes and not self._repo.status_exists(changes["status_id"]):
            raise CardStatusNotFoundError()
        if "card_type_id" in changes and not self._repo.card_type_exists(
            changes["card_type_id"]
        ):
            raise CardTypeNotFoundError()
        if "card_numb" in changes:
            changes["last_four"] = changes["card_numb"][-4:]
        return self._repo.update(row, changes)

    def get_main_card(self, user_id: int) -> Card | None:
        return self._repo.get_main_card(user_id)

    def set_main_card(self, user_id: int, card_id: int) -> Card:
        card = self._repo.get_by_id(card_id, include_deleted=False)
        if card is None:
            raise CardNotFoundError()
        if card.user_id != user_id:
            raise CardDoesNotBelongToUserError()
        result = self._repo.set_main_card(user_id, card_id)
        if result is None:
            raise CardNotFoundError()
        return result

    def expire_overdue_cards(self, *, limit: int = 100) -> dict[str, int]:
        """
        Soft-delete cards past expires_at. Sweeps remaining balance to the user's
        main card (or oldest other active card if the expired card is main).
        Skips cards with pending transactions (same rule as manual delete).
        """
        stats = {
            "cards_expired": 0,
            "cards_skipped_pending": 0,
            "cards_skipped_no_destination": 0,
            "cards_errors": 0,
        }
        for card in self._repo.list_expired_for_soft_delete(limit=limit):
            try:
                self._expire_card(card.card_id)
                stats["cards_expired"] += 1
            except CardHasPendingTransactionsError:
                stats["cards_skipped_pending"] += 1
            except NoSweepDestinationError:
                stats["cards_skipped_no_destination"] += 1
            except CardNotFoundError:
                stats["cards_errors"] += 1
        return stats

    def _expire_card(self, card_id: int) -> None:
        self._soft_delete_with_sweep(card_id)

    def _soft_delete_with_sweep(self, card_id: int) -> None:
        row = self._repo.get_by_id_for_update(card_id)
        if row is None:
            raise CardNotFoundError()
        if self._repo.has_pending_transactions(card_id):
            raise CardHasPendingTransactionsError()

        if row.balance > 0:
            destination = self._find_sweep_destination(row)
            if destination is None:
                raise NoSweepDestinationError()
            swept_amount = row.balance
            self._repo.transfer_balance(
                from_card_id=row.card_id,
                to_card_id=destination.card_id,
                amount=swept_amount,
            )
            self._repo.create_completed_sweep_transaction(
                from_card_id=row.card_id,
                to_card_id=destination.card_id,
                amount=swept_amount,
            )

        was_main = row.is_main
        user_id = row.user_id
        self._repo.soft_delete(row)
        if was_main:
            self._repo._promote_next_main_card(user_id)

    def _find_sweep_destination(self, card: Card) -> Card | None:
        main = self._repo.get_main_card(card.user_id)
        if main is not None and main.card_id != card.card_id:
            return main
        return self._repo.get_oldest_active_card_for_user(
            card.user_id, exclude_card_id=card.card_id
        )

    def delete(self, card_id: int) -> None:
        self._soft_delete_with_sweep(card_id)

    def hard_delete(self, card_id: int) -> None:
        row = self._repo.get_by_id(card_id, include_deleted=True)
        if row is None:
            raise CardNotFoundError()
        if self._repo.has_transactions(card_id):
            raise CardHasTransactionsError()
        was_main = row.is_main and row.deleted_at is None
        user_id = row.user_id
        self._repo.hard_delete(row)
        if was_main:
            self._repo._promote_next_main_card(user_id)

    def lookup_by_card_number(self, card_numb: str) -> tuple[Card, User] | None:
        return self._repo.lookup_by_card_number(card_numb)

    def restore(self, card_id: int) -> Card:
        row = self._repo.get_by_id(card_id, include_deleted=True)
        if row is None or row.deleted_at is None:
            raise CardNotFoundError()
        return self._repo.restore(row)

    def _validate_fk(self, *, user_id: int, status_id: int, card_type_id: int) -> None:
        if not self._repo.user_exists(user_id):
            raise UserNotFoundError()
        if not self._repo.status_exists(status_id):
            raise CardStatusNotFoundError()
        if not self._repo.card_type_exists(card_type_id):
            raise CardTypeNotFoundError()
