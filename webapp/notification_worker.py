"""Background worker for the reusable notification subsystem."""
from __future__ import annotations

import asyncio
import logging

from sms_app.services.notification_service import dispatch_due_notifications, materialize_class_reminders

logger = logging.getLogger("notification_worker")
POLL_SECONDS = 60


def worker_tick() -> tuple[int, int]:
    """Materialize schedule-derived notifications and deliver due push jobs."""
    created = materialize_class_reminders()
    delivered = dispatch_due_notifications(limit=50)
    return created, delivered


async def run_forever():
    while True:
        try:
            created, delivered = worker_tick()
            if created or delivered:
                logger.info("notification worker: created=%s delivered=%s", created, delivered)
        except Exception:
            logger.exception("notification worker: unexpected error")
        await asyncio.sleep(POLL_SECONDS)
