"""Poll FEP Nexus for approved disbursements and credit card balances."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

import nexus
from models.transaction import Transaction
from models.transaction_type import TransactionType
from repositories.card.card import CardRepository
from repositories.transaction.transaction import TransactionRepository
from services.nexus.funding import sync_nexus_env
from sqlalchemy import select

logger = logging.getLogger(__name__)

NEXUS_IDEMPOTENCY_PREFIX = "nexus-fund:"


def nexus_idempotency_key(request_id: str) -> str:
    return f"{NEXUS_IDEMPOTENCY_PREFIX}{request_id}"


def _already_credited(db, request_id: str) -> bool:
    return (
        TransactionRepository(db).get_by_idempotency_key(
            nexus_idempotency_key(request_id)
        )
        is not None
    )


def _deposit_type_id(db) -> int | None:
    stmt = select(TransactionType.transaction_type_id).where(
        TransactionType.name == "deposit"
    )
    return db.execute(stmt).scalar_one_or_none()


def _credit_card(db, raw: dict) -> bool:
    request_id = str(raw["id"])
    if _already_credited(db, request_id):
        return True

    external_ref = raw.get("external_ref")
    if not external_ref:
        logger.warning("nexus claim: missing external_ref on %s", request_id)
        return False

    card_id = int(external_ref)
    amount = Decimal(str(raw["amount"]))
    card_repo = CardRepository(db)
    tx_repo = TransactionRepository(db)

    card = card_repo.get_by_id_for_update(card_id)
    if card is None:
        logger.warning("nexus claim: card %s not found", card_id)
        return False

    deposit_type_id = _deposit_type_id(db)
    completed_status_id = tx_repo.get_status_id_by_name("completed")
    if deposit_type_id is None or completed_status_id is None:
        logger.error("nexus claim: deposit type or completed status missing")
        return False

    now = datetime.now(timezone.utc)
    card.balance = card.balance + amount
    db.add(
        Transaction(
            sender_card_id=None,
            recipient_card_id=card_id,
            transaction_type_id=deposit_type_id,
            status_id=completed_status_id,
            amount=amount,
            note=f"nexus:{request_id}",
            idempotency_key=nexus_idempotency_key(request_id),
            processing_eligible_at=now,
            processed_at=now,
            processed_by="nexus",
        )
    )
    db.commit()
    logger.info(
        "nexus claim: credited card_id=%s amount=%s request_id=%s",
        card_id,
        amount,
        request_id,
    )
    return True


async def _try_confirm_pending(raw: dict) -> bool:
    request_id = str(raw["id"])
    external_ref = raw.get("external_ref")

    items = await nexus.fetch_approved()
    for item in items:
        ident = item.get("id")
        if not ident:
            continue
        if str(ident) == request_id or item.get("external_ref") == external_ref:
            return await nexus.confirm(ident)

    return await nexus.confirm(request_id)


async def apply_nexus_request_credit(db, raw: dict) -> bool:
    """Credit a card when Nexus approved/completed a fund request (idempotent)."""
    sync_nexus_env()

    status = raw.get("status")
    if status in ("requested", "rejected", None):
        return False

    request_id = str(raw["id"])
    if _already_credited(db, request_id):
        return True

    if status == "approved":
        await _try_confirm_pending(raw)
        fresh = await nexus.get_request(request_id)
        if fresh:
            raw = fresh
            status = fresh.get("status")

    if status == "completed":
        try:
            return _credit_card(db, raw)
        except Exception:
            db.rollback()
            logger.exception("nexus credit failed for request_id=%s", request_id)
            return False

    return False


def claim_approved_funds(db) -> dict[str, int]:
    """Sync entry point for the in-app scheduler."""
    return asyncio.run(_claim_approved_funds(db))


async def _claim_approved_funds(db) -> dict[str, int]:
    stats = {"nexus_claimed": 0, "nexus_skipped": 0, "nexus_errors": 0}
    sync_nexus_env()

    try:
        items = await nexus.fetch_approved()
    except Exception:
        logger.exception("nexus fetch_approved failed")
        stats["nexus_errors"] += 1
        items = []

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

            raw = {
                "id": ident,
                "external_ref": external_ref,
                "amount": item["amount"],
                "status": "completed",
            }
            if await apply_nexus_request_credit(db, raw):
                stats["nexus_claimed"] += 1
            else:
                stats["nexus_skipped"] += 1
        except Exception:
            db.rollback()
            logger.exception("nexus claim failed for dispense_id=%s", ident)
            stats["nexus_errors"] += 1

    for status in ("approved", "completed"):
        try:
            rows = await nexus.list_requests(status=status)
        except Exception:
            logger.exception("nexus list_requests(%s) failed", status)
            stats["nexus_errors"] += 1
            continue

        for raw in rows:
            request_id = str(raw.get("id", ""))
            if not request_id or _already_credited(db, request_id):
                stats["nexus_skipped"] += 1
                continue
            try:
                if await apply_nexus_request_credit(db, raw):
                    stats["nexus_claimed"] += 1
                else:
                    stats["nexus_skipped"] += 1
            except Exception:
                db.rollback()
                logger.exception("nexus sweep failed for request_id=%s", request_id)
                stats["nexus_errors"] += 1

    return stats
