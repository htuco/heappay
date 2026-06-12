"""In-process scheduler for background jobs (started with the FastAPI app)."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from jobs.scheduled_tasks import run

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

    from settings import Settings

logger = logging.getLogger(__name__)


async def _scheduled_tasks_loop(interval_seconds: int) -> None:
    """Run maintenance immediately, then every *interval_seconds*."""
    while True:
        try:
            stats = await asyncio.to_thread(run)
            logger.info(
                "scheduled tasks: cards_expired=%(cards_expired)d "
                "cards_skipped_pending=%(cards_skipped_pending)d "
                "cards_skipped_no_destination=%(cards_skipped_no_destination)d "
                "processed=%(processed)d allowed=%(allowed)d denied=%(denied)d "
                "skipped=%(skipped)d errors=%(errors)d",
                stats,
            )
        except Exception:
            logger.exception("scheduled tasks failed")
        await asyncio.sleep(interval_seconds)


def lifespan(settings: Settings):
    """FastAPI lifespan that runs the transaction processor on an interval."""

    @asynccontextmanager
    async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task | None = None
        if settings.tx_processor_scheduler_enabled:
            logger.info(
                "starting scheduled tasks (card expiry + transactions, every %ss)",
                settings.tx_processor_interval_seconds,
            )
            task = asyncio.create_task(
                _scheduled_tasks_loop(settings.tx_processor_interval_seconds)
            )
        yield
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info("scheduled tasks stopped")

    return _lifespan
