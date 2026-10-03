# NextGen SMS Notification Subsystem — 0.0.0

Adds a reusable persistent notification subsystem with:

- Browser Web Push subscriptions + service worker.
- Per-user notification inbox and unread state.
- Per-category preferences for timetable, class reminders and system updates.
- Scheduled/retryable Web Push delivery with stale-subscription cleanup.
- Reusable `notification_service.notify_user()` / `notify_users()` producer API.
- Timetable publish/update and faculty-override notification producers.
- Automatic class reminders (10 min default; 5/10/15/30 configurable).
- Conservative student class reminders when a semester has exactly one published timetable, because the current student model has no section field.
- VAPID setup helper and deployment documentation.

## Important

Web Push must be configured on the backend with VAPID credentials before users can enable browser notifications. See `WEB_PUSH_SETUP.md`.

The exact project-relative paths are preserved inside this single wrapper folder for the NextGen Unzipit workflow.
