"""
Dev-only: seed cards at various expiry offsets for a user, to exercise the
card-expiry-warning email (jobs.scheduled_tasks / CardExpiryNotifier) and the
in-app "card expires soon" watcher without waiting on real calendar dates.

Run manually:

    cd server
    uv run python -m jobs.seed_card_expiry_scenarios <user_id>

Safe to re-run: cards are keyed by a deterministic card number per
(user_id, scenario), so re-running just refreshes expires_at on the same rows
instead of creating duplicates.
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select

from database import SessionLocal
from models.card_type import CardType
from repositories.card.card import CardRepository

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Scenario:
    name: str
    offset_days: int


@dataclass(frozen=True)
class SeededCard:
    scenario: str
    card_id: int
    expires_at: date
    last_four: str


SCENARIOS: list[Scenario] = [
    Scenario("already_expired", -5),
    Scenario("expiring_tomorrow", 1),
    Scenario("expiring_in_29_days", 29),
    Scenario("expiring_in_30_days", 30),
    Scenario("expiring_in_31_days", 31),
    Scenario("far_future", 365),
]


def _card_numb(user_id: int, index: int) -> str:
    return f"9{user_id:06d}{index:02d}".ljust(16, "0")


def seed(user_id: int) -> list[SeededCard]:
    db = SessionLocal()
    results: list[SeededCard] = []
    try:
        repo = CardRepository(db)

        status_id = repo.get_status_id_by_name("active")
        if status_id is None:
            raise SystemExit("No 'active' card status found — run migrations first.")

        card_type_id = db.scalars(select(CardType.card_type_id).limit(1)).first()
        if card_type_id is None:
            raise SystemExit("No card_types seeded — run migrations first.")

        today = date.today()
        for index, scenario in enumerate(SCENARIOS):
            card_numb = _card_numb(user_id, index)
            expires_at = today + timedelta(days=scenario.offset_days)

            existing = repo.find_by_card_number_including_deleted(card_numb)
            if existing is not None:
                row = repo.update(existing, {"expires_at": expires_at})
            else:
                row = repo.create(
                    user_id=user_id,
                    status_id=status_id,
                    card_type_id=card_type_id,
                    card_numb=card_numb,
                    last_four=card_numb[-4:],
                    cvc="123",
                    expires_at=expires_at,
                    cardholder_name=f"SEED {scenario.name}",
                )
            results.append(
                SeededCard(
                    scenario=scenario.name,
                    card_id=row.card_id,
                    expires_at=row.expires_at,
                    last_four=row.last_four,
                )
            )
        return results
    finally:
        db.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        logger.error("Usage: uv run python -m jobs.seed_card_expiry_scenarios <user_id>")
        return 1

    user_id = int(sys.argv[1])
    results = seed(user_id)

    logger.info("Seeded %d cards for user_id=%d:", len(results), user_id)
    for card in results:
        logger.info(
            "  %-22s card_id=%-6d expires_at=%s last_four=%s",
            card.scenario,
            card.card_id,
            card.expires_at,
            card.last_four,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
