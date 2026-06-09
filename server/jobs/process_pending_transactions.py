"""
Process pending transactions (allow / deny by rule).

Run manually or from cron:

    cd server
    uv run python -m jobs.process_pending_transactions
"""

from __future__ import annotations

import logging
import sys

from database import SessionLocal
from repositories.transaction.transaction import TransactionRepository
from services.transaction.transaction_processor import TransactionProcessorService

logger = logging.getLogger(__name__)


def run() -> dict[str, int]:
    db = SessionLocal()
    try:
        processor = TransactionProcessorService(TransactionRepository(db))
        return processor.process_batch()
    finally:
        db.close()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        stats = run()
    except Exception:
        logger.exception("transaction processor failed")
        return 1

    logger.info(
        "transaction processor finished: processed=%(processed)d allowed=%(allowed)d "
        "denied=%(denied)d skipped=%(skipped)d errors=%(errors)d",
        stats,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
