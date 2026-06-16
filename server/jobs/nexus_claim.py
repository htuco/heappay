"""Poll FEP Nexus for approved disbursements and credit card balances."""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal

import nexus
from repositories.card.card import CardRepository

logger = logging.getLogger(__name__)


def claim_approved_funds(db) -> dict[str, int]:
    """Sync entry point for the in-app scheduler."""
    return asyncio.run(_claim_approved_funds(db))


async def _claim_approved_funds(db) -> dict[str, int]:
    stats = {"nexus_claimed": 0, "nexus_skipped": 0, "nexus_errors": 0}
    card_repo = CardRepository(db)

    try:
        items = await nexus.fetch_approved()
    except Exception:
        logger.exception("nexus fetch_approved failed")
        stats["nexus_errors"] += 1
        return stats

    for item in items:
        ident = item.get("id")
        if not ident:
            stats["nexus_skipped"] += 1
            continue

        try:
            if not await nexus.confirm(ident):
                stats["nexus_skipped"] += 1
                continue

            external_ref = item.get("external_ref")
            if not external_ref:
                logger.warning("nexus claim: missing external_ref on %s", ident)
                stats["nexus_errors"] += 1
                continue

            card_id = int(external_ref)
            amount = Decimal(str(item["amount"]))
            card = card_repo.get_by_id_for_update(card_id)
            if card is None:
                logger.warning("nexus claim: card %s not found", card_id)
                stats["nexus_errors"] += 1
                continue

            card.balance = card.balance + amount
            db.commit()
            stats["nexus_claimed"] += 1
            logger.info(
                "nexus claim: credited card_id=%s amount=%s dispense_id=%s",
                card_id,
                amount,
                ident,
            )
        except Exception:
            db.rollback()
            logger.exception("nexus claim failed for dispense_id=%s", ident)
            stats["nexus_errors"] += 1

    return stats
