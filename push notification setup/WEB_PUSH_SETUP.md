# NextGen SMS — Reusable Web Push Notification Subsystem

NextGen SMS now has a reusable notification pipeline that future modules can use without implementing their own browser-push logic.

## Architecture

`producer -> notifications table -> notification worker -> Web Push -> service worker -> browser`

The reusable service lives in `sms_app/services/notification_service.py`.

It provides:

- Persistent per-user notification records.
- Category preferences: `TIMETABLE`, `CLASS_REMINDER`, `SYSTEM`.
- Multiple browser/device subscriptions per user.
- Scheduled delivery with retry and stale-subscription cleanup.
- Source/dedupe metadata so future producers can identify the originating feature.
- A stored in-app notification inbox even when Web Push is unavailable.

The current timetable integration emits published timetable changes and override changes into the same subsystem. Class reminders are generated from the published timetable and are delivered through the same queue.

## VAPID setup

Web Push requires a VAPID key pair. Generate one with:

```text
python scripts_generate_vapid_keys.py
```

Keep the private key secret. Configure the backend environment with:

```text
VAPID_PUBLIC_KEY=<printed public key>
VAPID_PRIVATE_KEY=<PEM private key or absolute path to the PEM file>
VAPID_CLAIMS_SUB=mailto:your-admin-email@example.com
APP_TIMEZONE=Asia/Kolkata
```

`VAPID_PUBLIC_KEY` is returned to the browser. `VAPID_PRIVATE_KEY` is server-only and must never be committed or exposed in frontend code.

## Browser requirements

Web Push requires an active service worker and a secure context (normally HTTPS in production). The browser subscription is requested only after a user action such as pressing **Enable**; the application does not silently prompt on page load.

## API surface

```text
GET    /api/notifications/config
GET    /api/notifications
GET    /api/notifications/preferences
PUT    /api/notifications/preferences
POST   /api/notifications/subscriptions
DELETE /api/notifications/subscriptions
POST   /api/notifications/{id}/read
```

Future producers should call `notification_service.notify_user()` or `notify_users()` instead of talking to the push transport directly.

Example:

```python
from sms_app.services.notification_service import notify_users, CATEGORY_SYSTEM

notify_users(
    ["student001", "student002"],
    category=CATEGORY_SYSTEM,
    title="New announcement",
    body="A new department announcement is available.",
    url="/dashboard",
    source_type="ANNOUNCEMENT",
    source_id="42",
)
```

## Class reminder behavior

The default reminder is 10 minutes before class. Users can select 5, 10, 15 or 30 minutes from the notification panel.

Student reminders are intentionally conservative because the current student model does not store a section assignment. A student receives an automatic class reminder only when their current semester has exactly one published timetable, preventing notifications for another section.
