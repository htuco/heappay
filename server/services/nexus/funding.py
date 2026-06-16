import os
from decimal import Decimal

import nexus
from repositories.card.card import CardRepository
from settings import get_settings


class NexusNotConfiguredError(Exception):
    """NEXUS_URL, NEXUS_SECRET_KEY, or NEXUS_PROJECT is missing."""


class NexusRequestFailedError(Exception):
    """FEP Nexus rejected or did not return a fund request."""


class CardNotFoundError(Exception):
    """Referenced card does not exist."""


class ForbiddenError(Exception):
    """Caller does not own the card."""


def sync_nexus_env() -> None:
    """Expose Nexus settings to nexus.py (reads os.environ)."""
    settings = get_settings()
    if settings.nexus_url:
        os.environ["NEXUS_URL"] = settings.nexus_url
    if settings.nexus_secret_key:
        os.environ["NEXUS_SECRET_KEY"] = settings.nexus_secret_key
    if settings.nexus_project:
        os.environ["NEXUS_PROJECT"] = settings.nexus_project


def is_nexus_configured() -> bool:
    return get_settings().nexus_enabled


class NexusFundingService:
    def __init__(self, card_repo: CardRepository) -> None:
        self._cards = card_repo

    async def request_funds_for_card(
        self, *, card_id: int, amount: Decimal, user_id: int
    ) -> dict:
        if not is_nexus_configured():
            raise NexusNotConfiguredError()

        sync_nexus_env()

        card = self._cards.get_by_id(card_id)
        if card is None:
            raise CardNotFoundError()
        if card.user_id != user_id:
            raise ForbiddenError()

        result = await nexus.request_funds(
            float(amount),
            note="topup",
            external_ref=str(card_id),
        )
        if not result or not result.get("id"):
            raise NexusRequestFailedError()
        return result

    async def get_request(self, request_id: str) -> dict | None:
        if not is_nexus_configured():
            raise NexusNotConfiguredError()
        sync_nexus_env()
        return await nexus.get_request(request_id)
