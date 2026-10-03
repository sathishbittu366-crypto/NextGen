"""Reusable notification subsystem.

The subsystem deliberately separates notification creation from delivery:

* Producers (timetable, results, attendance, future modules) call ``notify_*``.
* Notifications are persisted per user with category/source/dedupe metadata.
* User preferences decide whether a category may be pushed.
* Browser subscriptions are stored per authenticated user/device.
* A background worker claims due notifications and delivers Web Push.

This keeps product-specific logic out of the push transport and lets future
channels (email/SMS/in-app) reuse the same notification records.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta
from typing import Any, Iterable
from urllib.parse import urlparse

from database import connect
from sms_app.services.timetable_service import app_timezone, local_now

logger = logging.getLogger("notification_service")

CATEGORY_TIMETABLE = "TIMETABLE"
CATEGORY_CLASS_REMINDER = "CLASS_REMINDER"
CATEGORY_SYSTEM = "SYSTEM"
CATEGORIES = (CATEGORY_TIMETABLE, CATEGORY_CLASS_REMINDER, CATEGORY_SYSTEM)

STATUS_PENDING = "PENDING"
STATUS_SENDING = "SENDING"
STATUS_SENT = "SENT"
STATUS_FAILED = "FAILED"
STATUS_SKIPPED = "SKIPPED"

DEFAULT_CLASS_REMINDER_MINUTES = 10
MAX_PUSH_PAYLOAD_BYTES = 3800
MAX_SEND_ATTEMPTS = 3


def _utcish_naive_now() -> datetime:
    return local_now().replace(tzinfo=None)


def _json_text(value: Any) -> str:
    return json.dumps(value or {}, separators=(",", ":"), ensure_ascii=False)


def _clean_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    return text[:limit]


def _validate_endpoint(endpoint: str) -> str:
    endpoint = _clean_text(endpoint, 768)
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Push subscription endpoint must be an HTTPS URL")
    return endpoint


def web_push_enabled() -> bool:
    return bool(
        os.environ.get("VAPID_PRIVATE_KEY", "").strip()
        and os.environ.get("VAPID_CLAIMS_SUB", "").strip()
    )


def _load_vapid_private_key():
    """Load the VAPID private key for pywebpush.

    ``VAPID_PRIVATE_KEY`` may be either a PEM string or a filesystem path.
    Keeping this lookup server-side means the private key is never exposed to
    the browser; only the public application server key is returned by the API.
    """
    raw = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not raw:
        return None
    if "BEGIN" in raw:
        return raw
    if os.path.isfile(raw):
        return raw
    raise RuntimeError("VAPID_PRIVATE_KEY must contain a PEM key or a readable PEM file path")


def get_vapid_public_key() -> str | None:
    configured = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
    if configured:
        return configured

    private = _load_vapid_private_key()
    if not private:
        return None
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        import base64

        if isinstance(private, str) and "BEGIN" not in private:
            with open(private, "rb") as handle:
                key_bytes = handle.read()
        else:
            key_bytes = private.encode("utf-8")
        key = serialization.load_pem_private_key(key_bytes, password=None)
        if not isinstance(key, ec.EllipticCurvePrivateKey):
            raise ValueError("VAPID private key must be an EC private key")
        public_bytes = key.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        return base64.urlsafe_b64encode(public_bytes).decode("ascii").rstrip("=")
    except Exception as exc:
        raise RuntimeError(f"Could not derive VAPID public key: {exc}") from exc



def ensure_default_preferences(c, username: str) -> None:
    for category in CATEGORIES:
        c.execute(
            """
            INSERT IGNORE INTO notification_preferences(
                username, category, enabled, reminder_minutes
            ) VALUES(%s,%s,1,%s)
            """,
            (username, category, DEFAULT_CLASS_REMINDER_MINUTES if category == CATEGORY_CLASS_REMINDER else None),
        )


def get_preferences(username: str) -> dict[str, Any]:
    with connect() as c:
        ensure_default_preferences(c, username)
        rows = c.execute(
            "SELECT category, enabled, reminder_minutes FROM notification_preferences WHERE username=%s ORDER BY category",
            (username,),
        ).fetchall()
        push_row = c.execute(
            "SELECT COUNT(*) AS count FROM push_subscriptions WHERE username=%s AND active=1",
            (username,),
        ).fetchone()
    prefs = {
        row["category"]: {
            "enabled": bool(row["enabled"]),
            "reminder_minutes": int(row["reminder_minutes"] or DEFAULT_CLASS_REMINDER_MINUTES),
        }
        for row in rows
    }
    for category in CATEGORIES:
        prefs.setdefault(category, {"enabled": True, "reminder_minutes": DEFAULT_CLASS_REMINDER_MINUTES})
    return {
        "categories": prefs,
        "push_enabled": bool(int(push_row["count"] if push_row else 0)),
        "push_supported": web_push_enabled() and bool(get_vapid_public_key()),
    }


def set_preference(username: str, category: str, *, enabled: bool | None = None, reminder_minutes: int | None = None) -> dict[str, Any]:
    category = category.strip().upper()
    if category not in CATEGORIES:
        raise ValueError("Unsupported notification category")
    if reminder_minutes is not None and category == CATEGORY_CLASS_REMINDER:
        if int(reminder_minutes) not in (5, 10, 15, 30):
            raise ValueError("Reminder timing must be one of 5, 10, 15 or 30 minutes")
    elif reminder_minutes is not None and category != CATEGORY_CLASS_REMINDER:
        reminder_minutes = None

    with connect() as c:
        ensure_default_preferences(c, username)
        current = c.execute(
            "SELECT enabled, reminder_minutes FROM notification_preferences WHERE username=%s AND category=%s",
            (username, category),
        ).fetchone()
        next_enabled = bool(current["enabled"]) if current and enabled is None else bool(enabled)
        next_minutes = int(current["reminder_minutes"] or DEFAULT_CLASS_REMINDER_MINUTES) if current else DEFAULT_CLASS_REMINDER_MINUTES
        if reminder_minutes is not None:
            next_minutes = int(reminder_minutes)
        c.execute(
            """
            UPDATE notification_preferences
               SET enabled=%s, reminder_minutes=%s, updated_at=CURRENT_TIMESTAMP
             WHERE username=%s AND category=%s
            """,
            (1 if next_enabled else 0, next_minutes if category == CATEGORY_CLASS_REMINDER else None, username, category),
        )
    return {"category": category, "enabled": next_enabled, "reminder_minutes": next_minutes}


def upsert_push_subscription(
    username: str,
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    expiration_time: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    endpoint = _validate_endpoint(endpoint)
    p256dh = _clean_text(p256dh, 255)
    auth = _clean_text(auth, 255)
    if not p256dh or not auth:
        raise ValueError("Push subscription keys are required")

    with connect() as c:
        c.execute(
            """
            INSERT INTO push_subscriptions(
                username, endpoint, p256dh, auth, expiration_time, user_agent, active, last_seen_at
            ) VALUES(%s,%s,%s,%s,%s,%s,1,CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                username=VALUES(username),
                p256dh=VALUES(p256dh),
                auth=VALUES(auth),
                expiration_time=VALUES(expiration_time),
                user_agent=VALUES(user_agent),
                active=1,
                last_seen_at=CURRENT_TIMESTAMP
            """,
            (username, endpoint, p256dh, auth, _clean_text(expiration_time, 64) or None, _clean_text(user_agent, 512) or None),
        )
    return {"saved": True}


def delete_push_subscription(username: str, endpoint: str) -> bool:
    endpoint = _validate_endpoint(endpoint)
    with connect() as c:
        row = c.execute(
            "SELECT id FROM push_subscriptions WHERE username=%s AND endpoint=%s",
            (username, endpoint),
        ).fetchone()
        if not row:
            return False
        c.execute("DELETE FROM push_subscriptions WHERE id=%s", (row["id"],))
    return True


def list_notifications(username: str, limit: int = 30, unread_only: bool = False) -> dict[str, Any]:
    limit = max(1, min(int(limit), 100))
    where = "WHERE username=%s"
    params: list[Any] = [username]
    if unread_only:
        where += " AND read_at IS NULL"
    with connect() as c:
        rows = c.execute(
            f"""
            SELECT id, category, title, body, url, data_json, status, scheduled_for, sent_at, read_at, created_at
              FROM notifications
              {where}
             ORDER BY created_at DESC, id DESC
             LIMIT %s
            """,
            (*params, limit),
        ).fetchall()
        unread = c.execute(
            "SELECT COUNT(*) AS count FROM notifications WHERE username=%s AND read_at IS NULL",
            (username,),
        ).fetchone()
    result = []
    for row in rows:
        try:
            data = json.loads(row["data_json"] or "{}")
        except (TypeError, ValueError):
            data = {}
        result.append({
            "id": int(row["id"]),
            "category": row["category"],
            "title": row["title"],
            "body": row["body"],
            "url": row["url"],
            "data": data,
            "status": row["status"],
            "scheduled_for": row["scheduled_for"].isoformat(sep=" ") if row["scheduled_for"] else None,
            "sent_at": row["sent_at"].isoformat(sep=" ") if row["sent_at"] else None,
            "read_at": row["read_at"].isoformat(sep=" ") if row["read_at"] else None,
            "created_at": row["created_at"].isoformat(sep=" ") if row["created_at"] else None,
        })
    return {"notifications": result, "unread_count": int(unread["count"] if unread else 0)}


def mark_read(username: str, notification_id: int) -> bool:
    with connect() as c:
        cur = c.execute(
            "UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=%s AND username=%s",
            (notification_id, username),
        )
    return cur.rowcount > 0


def _normalize_recipients(usernames: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in usernames:
        username = str(raw or "").strip()
        key = username.casefold()
        if username and key not in seen:
            seen.add(key)
            result.append(username)
    return result


def notify_user(
    username: str,
    *,
    category: str,
    title: str,
    body: str,
    url: str | None = None,
    data: dict[str, Any] | None = None,
    scheduled_for: datetime | None = None,
    dedupe_key: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    channels: tuple[str, ...] = ("IN_APP", "WEB_PUSH"),
) -> int | None:
    category = str(category).strip().upper()
    if category not in CATEGORIES:
        raise ValueError("Unsupported notification category")
    username = str(username or "").strip()
    if not username:
        return None
    title = _clean_text(title, 180)
    body = _clean_text(body, 600)
    url = _clean_text(url, 768) or None
    data = dict(data or {})
    data.setdefault("category", category)
    data.setdefault("channels", list(channels))
    payload = {"title": title, "body": body, "url": url, "data": data}
    payload_bytes = len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    if payload_bytes > MAX_PUSH_PAYLOAD_BYTES:
        raise ValueError("Notification payload is too large")

    due = scheduled_for or local_now()
    due_naive = due.replace(tzinfo=None) if due.tzinfo else due
    with connect() as c:
        ensure_default_preferences(c, username)
        cur = c.execute(
            """
            INSERT INTO notifications(
                username, category, title, body, url, data_json, channels_json,
                source_type, source_id, dedupe_key, status, scheduled_for
            ) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PENDING',%s)
            ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
            """,
            (
                username, category, title, body, url, _json_text(data), _json_text(list(channels)),
                _clean_text(source_type, 64) or None, _clean_text(source_id, 128) or None,
                _clean_text(dedupe_key, 255) or None, due_naive,
            ),
        )
        return int(cur.lastrowid) if cur.lastrowid else None


def notify_users(usernames: Iterable[str], **kwargs: Any) -> list[int]:
    ids: list[int] = []
    for username in _normalize_recipients(usernames):
        notification_id = notify_user(username, **kwargs)
        if notification_id is not None:
            ids.append(notification_id)
    return ids


def notify_timetable_audience(
    *,
    semester_id: int,
    title: str,
    body: str,
    source_id: str,
    faculty_usernames: Iterable[str] = (),
    include_students: bool = True,
    url: str = "/timetable",
) -> list[int]:
    recipients = list(_normalize_recipients(faculty_usernames))
    if include_students:
        with connect() as c:
            rows = c.execute(
                """
                SELECT u.username
                  FROM users u
                  JOIN students s ON s.roll_no=u.student_roll_no
                 WHERE u.role='STUDENT' AND u.active=1 AND s.active=1
                   AND s.current_semester_id=%s
                """,
                (semester_id,),
            ).fetchall()
        recipients.extend(str(r["username"]) for r in rows)
    return notify_users(
        recipients,
        category=CATEGORY_TIMETABLE,
        title=title,
        body=body,
        url=url,
        source_type="TIMETABLE",
        source_id=str(source_id),
        dedupe_key=f"TIMETABLE:{source_id}:{_clean_text(body, 255)}",
    )


def _claim_due_notifications(limit: int = 50) -> list[dict[str, Any]]:
    cutoff = _utcish_naive_now()
    stale_before = cutoff - timedelta(minutes=10)
    with connect() as c:
        # Recover work from a process that died mid-send. The push call itself
        # is external, so we intentionally claim rows before sending.
        c.execute(
            """
            UPDATE notifications
               SET status='PENDING'
             WHERE status='SENDING' AND updated_at < %s
            """,
            (stale_before,),
        )
        rows = c.execute(
            """
            SELECT id, username, category, title, body, url, data_json,
                   channels_json, status, scheduled_for, attempt_count
              FROM notifications
             WHERE status='PENDING' AND scheduled_for <= %s
             ORDER BY scheduled_for ASC, id ASC
             LIMIT %s
            """,
            (cutoff, limit),
        ).fetchall()
        claimed: list[dict[str, Any]] = []
        for row in rows:
            cur = c.execute(
                "UPDATE notifications SET status='SENDING', attempt_count=attempt_count+1, updated_at=%s WHERE id=%s AND status='PENDING'",
                (cutoff, row["id"]),
            )
            if cur.rowcount == 1:
                claimed.append(dict(row))
        return claimed


def _push_send(row: dict[str, Any], subscription: dict[str, Any]) -> None:
    from pywebpush import webpush

    try:
        data = json.loads(row.get("data_json") or "{}")
    except (TypeError, ValueError):
        data = {}
    payload = {
        "title": row["title"],
        "body": row["body"],
        "url": row.get("url") or "/",
        "data": data,
        "notification_id": int(row["id"]),
    }
    claims_sub = os.environ.get("VAPID_CLAIMS_SUB", "").strip()
    private_key = _load_vapid_private_key()
    if not claims_sub or not private_key:
        raise RuntimeError("Web Push VAPID credentials are not configured")
    webpush(
        subscription_info={
            "endpoint": subscription["endpoint"],
            "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
        },
        data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        vapid_private_key=private_key,
        vapid_claims={"sub": claims_sub},
        ttl=3600,
    )


def _send_claimed(row: dict[str, Any]) -> None:
    username = row["username"]
    category = row["category"]
    with connect() as c:
        pref = c.execute(
            "SELECT enabled FROM notification_preferences WHERE username=%s AND category=%s",
            (username, category),
        ).fetchone()
        subscriptions = c.execute(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE username=%s AND active=1",
            (username,),
        ).fetchall()

    if pref and not bool(pref["enabled"]):
        with connect() as c:
            c.execute(
                "UPDATE notifications SET status='SKIPPED', last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                ("Notification category disabled by user", _utcish_naive_now(), row["id"]),
            )
        return

    if not subscriptions:
        with connect() as c:
            c.execute(
                "UPDATE notifications SET status='SKIPPED', last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                ("No active browser push subscription", _utcish_naive_now(), row["id"]),
            )
        return

    succeeded = 0
    errors: list[str] = []
    for sub in subscriptions:
        try:
            _push_send(row, sub)
            succeeded += 1
            with connect() as c:
                c.execute("UPDATE push_subscriptions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=%s", (sub["id"],))
        except Exception as exc:
            message = str(exc)[:600]
            errors.append(message)
            # 404/410 are the standard stale-subscription signals. Mark them
            # inactive so future jobs don't repeatedly attempt dead endpoints.
            status_code = getattr(exc, "response", None)
            status_code = getattr(status_code, "status_code", None)
            if status_code in (404, 410) or "410 Gone" in message or "404 Not Found" in message:
                with connect() as c:
                    c.execute("UPDATE push_subscriptions SET active=0 WHERE id=%s", (sub["id"],))

    now = _utcish_naive_now()
    attempts = int(row.get("attempt_count") or 1)
    with connect() as c:
        if succeeded:
            c.execute(
                "UPDATE notifications SET status='SENT', sent_at=%s, last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                (now, "; ".join(errors)[:1200] if errors else None, now, row["id"]),
            )
        elif attempts < MAX_SEND_ATTEMPTS:
            c.execute(
                "UPDATE notifications SET status='PENDING', scheduled_for=%s, last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                (now + timedelta(minutes=2), "; ".join(errors)[:1200], now, row["id"]),
            )
        else:
            c.execute(
                "UPDATE notifications SET status='FAILED', last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                ("; ".join(errors)[:1200], now, row["id"]),
            )


def dispatch_due_notifications(limit: int = 50) -> int:
    claimed = _claim_due_notifications(limit=limit)
    delivered = 0
    for row in claimed:
        try:
            _send_claimed(row)
            delivered += 1
        except Exception:
            logger.exception("notification dispatch failed for id=%s", row.get("id"))
            now = _utcish_naive_now()
            attempts = int(row.get("attempt_count") or 1)
            with connect() as c:
                if attempts < MAX_SEND_ATTEMPTS:
                    c.execute(
                        "UPDATE notifications SET status='PENDING', scheduled_for=%s, last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                        (now + timedelta(minutes=2), "Unexpected notification dispatch error", now, row["id"]),
                    )
                else:
                    c.execute(
                        "UPDATE notifications SET status='FAILED', last_error=%s, updated_at=%s WHERE id=%s AND status='SENDING'",
                        ("Unexpected notification dispatch error", now, row["id"]),
                    )
    return delivered


def _period_map(period_config_json: str | None) -> dict[tuple[str, int], dict[str, Any]]:
    try:
        raw = json.loads(period_config_json or "[]")
    except (TypeError, ValueError):
        return {}
    result: dict[tuple[str, int], dict[str, Any]] = {}
    positions: dict[str, int] = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        section = str(item.get("section") or "MORNING").upper()
        start = str(item.get("start") or "").strip()
        end = str(item.get("end") or "").strip()
        if not start or not end:
            continue
        position = positions.get(section, 0)
        positions[section] = position + 1
        result[(section, position)] = {"start": start, "end": end, "label": str(item.get("label") or f"P{position + 1}")}
    return result


def _schedule_entries_for_timetable(c, timetable_id: int, target_date: date) -> list[dict[str, Any]]:
    day_names = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
    day = day_names[target_date.weekday()]
    rows = c.execute(
        """
        SELECT e.id AS timetable_entry_id, e.start_slot, e.duration, e.section,
               e.block_type, e.subject_id, e.custom_label, e.room,
               t.semester_id, t.section_name, t.period_config_json,
               s.code AS subject_code, s.name AS subject_name
          FROM timetable_entries e
          JOIN timetables t ON t.id=e.timetable_id
          LEFT JOIN subjects s ON s.id=e.subject_id
         WHERE e.timetable_id=%s AND e.day_of_week=%s
         ORDER BY e.start_slot, e.id
        """,
        (timetable_id, day),
    ).fetchall()
    result = []
    for row in rows:
        periods = _period_map(row["period_config_json"])
        start = periods.get((str(row["section"]).upper(), int(row["start_slot"])))
        end = periods.get((str(row["section"]).upper(), int(row["start_slot"]) + max(1, int(row["duration"] or 1)) - 1))
        if not start or not end:
            continue
        result.append({
            **dict(row),
            "start_time": start["start"],
            "end_time": end["end"],
            "period_label": start["label"],
            "target_date": target_date.isoformat(),
        })
    return result


def materialize_class_reminders(now: datetime | None = None) -> int:
    """Create due class-reminder notifications for faculty and unambiguous students.

    Students do not currently have a stored section field. To avoid ever sending
    the wrong class reminder, student reminders are materialized only when their
    current semester has exactly one published timetable. Timetable-change
    notifications remain semester-scoped and therefore do not have this
    ambiguity.
    """
    now = now or local_now()
    target_date = now.date()
    created = 0
    try:
        from sms_app.services.timetable_service import resolve_effective_schedule

        with connect() as c:
            faculty_rows = c.execute("SELECT username FROM users WHERE role='FACULTY' AND active=1").fetchall()
            faculty_preferences = c.execute(
                """
                SELECT username, enabled, reminder_minutes FROM notification_preferences
                 WHERE category=%s
                """,
                (CATEGORY_CLASS_REMINDER,),
            ).fetchall()
            faculty_minutes = {str(r["username"]).casefold(): int(r["reminder_minutes"] or DEFAULT_CLASS_REMINDER_MINUTES) for r in faculty_preferences if bool(r["enabled"])}
            faculty_disabled = {str(r["username"]).casefold() for r in faculty_preferences if not bool(r["enabled"])}

        for faculty in faculty_rows:
            username = str(faculty["username"])
            if username.casefold() in faculty_disabled:
                continue
            minute_pref = faculty_minutes.get(username.casefold(), DEFAULT_CLASS_REMINDER_MINUTES)
            for row in resolve_effective_schedule(faculty_username=username, target_date=target_date):
                try:
                    start = datetime.combine(target_date, datetime.strptime(row["start_time"], "%H:%M").time(), tzinfo=app_timezone())
                except ValueError:
                    continue
                due = start - timedelta(minutes=minute_pref)
                if not (due <= now <= due + timedelta(minutes=1)):
                    continue
                label = row.get("subject_name") or row.get("custom_label") or row.get("block_type") or "Class"
                body = f"{label} starts at {row['start_time']}"
                if row.get("room"):
                    body += f" · Room {row['room']}"
                if row.get("section_name"):
                    body += f" · Section {row['section_name']}"
                created_id = notify_user(
                    username,
                    category=CATEGORY_CLASS_REMINDER,
                    title="Your next class",
                    body=body,
                    url="/timetable",
                    data={
                        "type": "CLASS_REMINDER",
                        "timetable_entry_id": int(row["timetable_entry_id"]),
                        "occurrence_date": target_date.isoformat(),
                    },
                    scheduled_for=due,
                    dedupe_key=f"CLASS_REMINDER:{username.casefold()}:{row['timetable_entry_id']}:{target_date.isoformat()}",
                    source_type="TIMETABLE_ENTRY",
                    source_id=str(row["timetable_entry_id"]),
                )
                if created_id:
                    created += 1

        # Student schedule resolution is intentionally conservative until the
        # data model carries a student's explicit section assignment.
        with connect() as c:
            students = c.execute(
                """
                SELECT u.username, s.current_semester_id
                  FROM users u
                  JOIN students s ON s.roll_no=u.student_roll_no
                 WHERE u.role='STUDENT' AND u.active=1 AND s.active=1
                   AND s.current_semester_id IS NOT NULL
                """
            ).fetchall()
            timetable_rows = c.execute(
                """
                SELECT id, semester_id, section_name
                  FROM timetables
                 WHERE department='CSD' AND status='PUBLISHED'
                """
            ).fetchall()
            grouped: dict[int, list[dict[str, Any]]] = {}
            for row in timetable_rows:
                grouped.setdefault(int(row["semester_id"]), []).append(dict(row))

            student_pref_rows = c.execute(
                """
                SELECT username, enabled, reminder_minutes
                  FROM notification_preferences
                 WHERE category=%s
                """,
                (CATEGORY_CLASS_REMINDER,),
            ).fetchall()
        student_minutes = {str(r["username"]).casefold(): int(r["reminder_minutes"] or DEFAULT_CLASS_REMINDER_MINUTES) for r in student_pref_rows if bool(r["enabled"])}
        student_disabled = {str(r["username"]).casefold() for r in student_pref_rows if not bool(r["enabled"])}
        for student in students:
            username = str(student["username"])
            if username.casefold() in student_disabled:
                continue
            options = grouped.get(int(student["current_semester_id"]), [])
            if len(options) != 1:
                continue
            minute_pref = student_minutes.get(username.casefold(), DEFAULT_CLASS_REMINDER_MINUTES)
            with connect() as c:
                entries = _schedule_entries_for_timetable(c, int(options[0]["id"]), target_date)
            # Only the first upcoming scheduled class should be materialized. If
            # the class is already past the chosen reminder window, later classes
            # are still eligible and will be found by the next worker tick.
            for row in entries:
                try:
                    start = datetime.combine(target_date, datetime.strptime(row["start_time"], "%H:%M").time(), tzinfo=app_timezone())
                except ValueError:
                    continue
                due = start - timedelta(minutes=minute_pref)
                if not (due <= now <= due + timedelta(minutes=1)):
                    continue
                label = row.get("subject_name") or row.get("custom_label") or row.get("block_type") or "Class"
                body = f"{label} starts at {row['start_time']}"
                if row.get("room"):
                    body += f" · Room {row['room']}"
                created_id = notify_user(
                    username,
                    category=CATEGORY_CLASS_REMINDER,
                    title="Your next class",
                    body=body,
                    url="/timetable",
                    data={
                        "type": "CLASS_REMINDER",
                        "timetable_entry_id": int(row["timetable_entry_id"]),
                        "occurrence_date": target_date.isoformat(),
                    },
                    scheduled_for=due,
                    dedupe_key=f"CLASS_REMINDER:{username.casefold()}:{row['timetable_entry_id']}:{target_date.isoformat()}",
                    source_type="TIMETABLE_ENTRY",
                    source_id=str(row["timetable_entry_id"]),
                )
                if created_id:
                    created += 1
    except Exception:
        logger.exception("Failed to materialize class reminders")
    return created
