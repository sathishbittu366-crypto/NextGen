from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, Field

from api.deps import CurrentUser, get_current_user
from api.envelope import ApiError, ok
from sms_app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PushSubscriptionBody(BaseModel):
    endpoint: str = Field(min_length=10, max_length=768)
    expiration_time: str | None = Field(default=None, max_length=64)
    user_agent: str | None = Field(default=None, max_length=512)
    keys: dict[str, str] = Field(default_factory=dict)


class PreferenceBody(BaseModel):
    category: str = Field(min_length=3, max_length=32)
    enabled: bool | None = None
    reminder_minutes: int | None = None


@router.get("/config")
async def notification_config(_: CurrentUser = Depends(get_current_user)):
    supported = False
    public_key = None
    try:
        public_key = notification_service.get_vapid_public_key()
        supported = bool(public_key) and notification_service.web_push_enabled()
    except RuntimeError:
        supported = False
    return ok({"supported": supported, "public_key": public_key})


@router.get("")
async def notification_list(
    limit: int = Query(default=30, ge=1, le=100),
    unread_only: bool = Query(default=False),
    user: CurrentUser = Depends(get_current_user),
):
    return ok(notification_service.list_notifications(user.username, limit=limit, unread_only=unread_only))


@router.post("/subscriptions")
async def register_subscription(body: PushSubscriptionBody, user: CurrentUser = Depends(get_current_user)):
    try:
        result = notification_service.upsert_push_subscription(
            user.username,
            endpoint=body.endpoint,
            p256dh=body.keys.get("p256dh", ""),
            auth=body.keys.get("auth", ""),
            expiration_time=body.expiration_time,
            user_agent=body.user_agent,
        )
    except ValueError as exc:
        raise ApiError(str(exc), 400, "VALIDATION_ERROR")
    return ok(result)


@router.delete("/subscriptions")
async def remove_subscription(endpoint: str = Body(..., embed=True), user: CurrentUser = Depends(get_current_user)):
    try:
        removed = notification_service.delete_push_subscription(user.username, endpoint)
    except ValueError as exc:
        raise ApiError(str(exc), 400, "VALIDATION_ERROR")
    return ok({"removed": removed})


@router.get("/preferences")
async def notification_preferences(user: CurrentUser = Depends(get_current_user)):
    return ok(notification_service.get_preferences(user.username))


@router.put("/preferences")
async def update_notification_preference(body: PreferenceBody, user: CurrentUser = Depends(get_current_user)):
    try:
        result = notification_service.set_preference(
            user.username,
            body.category,
            enabled=body.enabled,
            reminder_minutes=body.reminder_minutes,
        )
    except ValueError as exc:
        raise ApiError(str(exc), 400, "VALIDATION_ERROR")
    return ok(result)


@router.post("/test")
async def notification_test(user: CurrentUser = Depends(get_current_user)):
    notification_id = notification_service.notify_user(
        user.username,
        category=notification_service.CATEGORY_SYSTEM,
        title="NextGen SMS test notification",
        body="Web push is connected on this browser.",
        url="/",
        data={"type": "PUSH_TEST"},
        source_type="SYSTEM",
        source_id=f"push-test:{user.username}",
    )
    return ok({"queued": bool(notification_id), "notification_id": notification_id}, status_code=201)


@router.post("/{notification_id}/read")
async def notification_mark_read(notification_id: int, user: CurrentUser = Depends(get_current_user)):
    if notification_id <= 0:
        raise ApiError("Invalid notification id", 400, "VALIDATION_ERROR")
    updated = notification_service.mark_read(user.username, notification_id)
    return ok({"read": updated})
