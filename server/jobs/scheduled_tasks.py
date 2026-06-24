"""Scheduled maintenance: expire cards, process pending transactions, run recurring payments."""

from __future__ import annotations

from database import SessionLocal
from jobs.nexus_claim import claim_approved_funds
from repositories.card.card import CardRepository
from repositories.recurring_payment.recurring_payment import RecurringPaymentRepository
from repositories.transaction.transaction import TransactionRepository
from services.card.card import CardService
from services.nexus.funding import is_nexus_configured
from services.recurring_payment.recurring_payment import RecurringPaymentService
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
        recurring_stats = RecurringPaymentService(
            RecurringPaymentRepository(db),
            TransactionRepository(db),
        ).run_due_payments()
        nexus_stats = claim_approved_funds(db) if is_nexus_configured() else {}
        return {**card_stats, **tx_stats, **recurring_stats, **nexus_stats}
    finally:
        db.close()
