"""Scheduled maintenance: expire cards, process pending transactions, run recurring payments."""

from __future__ import annotations

from database import SessionLocal
from jobs.nexus_claim import claim_approved_funds
from repositories.card.card import CardRepository
from repositories.recurring_payment.recurring_payment import RecurringPaymentRepository
from repositories.transaction.transaction import TransactionRepository
from services.card.card import CardService
from services.email.card_expiry_notifier import CardExpiryNotifier
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
        card_expiry_stats = CardExpiryNotifier(db).notify_expiring_cards(
            days=settings.card_expiry_warning_days,
            limit=settings.card_expiration_batch_size,
        )
        return {**card_stats, **tx_stats, **recurring_stats, **nexus_stats, **card_expiry_stats}
    finally:
        db.close()
