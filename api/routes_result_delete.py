"""Dedicated admin result-upload deletion endpoint.

Kept separate from the learning router so deployments that still have an
older routes_learning.py can be upgraded without losing the destructive
admin operation. api.app mounts this router only when the main learning
router has not already registered the DELETE endpoint.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header

from api.deps import CurrentUser, get_current_user
from api.envelope import ApiError, ok
from sms_app.services.learning_service import delete_result_batch

router = APIRouter(tags=["learning"])


@router.delete("/api/results/admin/{batch_id}")
async def results_admin_delete_fallback(
    batch_id: int,
    delete_key: str | None = Header(default=None, alias="X-Result-Delete-Key"),
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a published result set; ADMIN + explicit delete key required."""
    if user.role != "ADMIN":
        raise ApiError("Admin access only", 403, "FORBIDDEN")

    configured_key = os.environ.get("RESULT_DELETE_KEY", "DELETE-RESULT").strip()
    if not configured_key:
        raise ApiError("Result delete key is not configured", 503, "DELETE_KEY_NOT_CONFIGURED")
    if not delete_key or delete_key.strip() != configured_key:
        raise ApiError("Invalid result delete key", 403, "INVALID_DELETE_KEY")

    result = delete_result_batch(batch_id=batch_id, admin_username=user.username)
    if not result:
        raise ApiError("Result upload not found", 404, "NOT_FOUND")
    return ok(result)
