"""In-process scheduler for background jobs (started with the FastAPI app)."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from jobs.process_pending_transactions import run

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

    from settings import Settings

logger = logging.getLogger(__name__)


async def _transaction_processor_loop(interval_seconds: int) -> None:
    """Run the processor immediately, then every *interval_seconds*."""
    while True:
        try:
            stats = await asyncio.to_thread(run)
            logger.info(
                "transaction processor: processed=%(processed)d allowed=%(allowed)d "
                "denied=%(denied)d skipped=%(skipped)d errors=%(errors)d",
                stats,
            )
        except Exception:
            logger.exception("transaction processor failed")
        await asyncio.sleep(interval_seconds)


def lifespan(settings: Settings):
    """FastAPI lifespan that runs the transaction processor on an interval."""

    @asynccontextmanager
    async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task | None = None
        if settings.tx_processor_scheduler_enabled:
            logger.info(
                "starting transaction processor scheduler (every %ss)",
                settings.tx_processor_interval_seconds,
            )
            task = asyncio.create_task(
                _transaction_processor_loop(settings.tx_processor_interval_seconds)
            )
        yield
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info("transaction processor scheduler stopped")

    return _lifespan
