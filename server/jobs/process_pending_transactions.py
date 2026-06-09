"""
Process pending transactions (allow / deny by rule).

Run manually or from cron:

    cd server
    uv run python -m jobs.process_pending_transactions
"""

from __future__ import annotations

import logging
import sys

from jobs.scheduled_tasks import run

logger = logging.getLogger(__name__)


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
        "scheduled tasks finished: cards_expired=%(cards_expired)d "
        "cards_skipped_pending=%(cards_skipped_pending)d cards_errors=%(cards_errors)d "
        "processed=%(processed)d allowed=%(allowed)d denied=%(denied)d "
        "skipped=%(skipped)d errors=%(errors)d",
        stats,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
