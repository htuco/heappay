"""Scheduled maintenance: expire cards, process pending transactions."""

from __future__ import annotations

from database import SessionLocal
from repositories.card.card import CardRepository
from repositories.transaction.transaction import TransactionRepository
from services.card.card import CardService
from services.transaction.transaction_processor import TransactionProcessorService
from settings import get_settings


def run() -> dict[str, int]:
    settings = get_settings()
    db = SessionLocal()
    try:
        card_stats = CardService(CardRepository(db)).expire_overdue_cards(
            limit=settings.card_expiration_batch_size
        )
        tx_stats = TransactionProcessorService(
            TransactionRepository(db), settings=settings
        ).process_batch()
        return {**card_stats, **tx_stats}
    finally:
        db.close()
