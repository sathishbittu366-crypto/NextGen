"""Database-backed absentee SMS queue and approval lifecycle.

SMS routing is owned by HOD scope, never by physical college block/location.
Each queue row snapshots both the responsible HOD and the exact gateway selected
at queue time. The worker therefore never has to guess which phone should send.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from database import audit, connect, get_setting

MESSAGE_TEMPLATE = "Dear Parent, {student} is absent for class today ({subject}, {date}). - VCET CSD Dept"
MAX_ATTEMPTS = 3
PROCESSING_LEASE_MINUTES = 15


def queue_absentees_for_session(session_id, absent_roll_nos, actor="system"):
    """Queue one parent SMS per student/day without sending it.

    Returns ``(queued_count, skipped_no_phone_count)`` for compatibility with
    the existing callers. Routing failures are retained as blocked queue rows
    with an explicit error and are never silently rerouted.
    """
    if not absent_roll_nos:
        return 0, 0
    with connect() as c:
        session = c.execute("""
            SELECT a.attendance_date, a.hod_username, s.name AS subject_name
            FROM attendance_sessions a JOIN subjects s ON s.id=a.subject_id
            WHERE a.id=%s
        """, (session_id,)).fetchone()
        if not session:
            return 0, 0
        hod_username = session.get("hod_username")
        send_date = session["attendance_date"]
        cap = int(get_setting("sms_daily_cap", "62") or 62)
        already_row = c.execute(
            "SELECT COUNT(*) AS n FROM sms_queue WHERE send_date=%s", (send_date,)
        ).fetchone()
        already_today = already_row["n"] if already_row else 0
        queued, skipped = 0, 0

        for roll_no in absent_roll_nos:
            if already_today + queued >= cap:
                break
            student = c.execute("""
                SELECT name, parent_phone, hod_username
                FROM students WHERE roll_no=%s AND active=1
            """, (roll_no,)).fetchone()
            if not student or not (student["parent_phone"] or "").strip():
                skipped += 1
                continue

            student_hod = student.get("hod_username")
            routing_error = None
            gateway_id = None
            if not hod_username or not student_hod or student_hod != hod_username:
                routing_error = "Attendance/student HOD ownership mismatch; SMS is blocked until ownership is corrected."
            else:
                gateway = c.execute("""
                    SELECT id, active, gateway_mode, device_id, username, password, local_url, modem_port
                    FROM sms_gateways WHERE hod_username=%s
                """, (hod_username,)).fetchone()
                if not gateway:
                    routing_error = "No SMS gateway is configured for this HOD."
                elif not gateway["active"]:
                    routing_error = "The HOD's SMS gateway is inactive."
                else:
                    gateway_id = gateway["id"]
                    mode = (gateway.get("gateway_mode") or "").lower()
                    if mode == "cloud" and not all([gateway.get("device_id"), gateway.get("username"), gateway.get("password")]):
                        routing_error = "Cloud gateway is missing device ID or credentials."
                    elif mode == "local" and not gateway.get("local_url"):
                        routing_error = "Local gateway URL is missing."
                    elif mode == "modem" and not gateway.get("modem_port"):
                        routing_error = "Modem port is missing."
                    elif mode not in ("cloud", "local", "modem"):
                        routing_error = f"Unsupported SMS gateway mode: {mode or 'empty'}."

            message = MESSAGE_TEMPLATE.format(
                student=student["name"], subject=session["subject_name"], date=send_date
            )
            cur = c.execute("""
                INSERT IGNORE INTO sms_queue(
                    roll_no,parent_phone,message,attendance_session_id,send_date,
                    hod_username,gateway_id,approved,status,error
                ) VALUES(%s,%s,%s,%s,%s,%s,%s,0,'PENDING',%s)
            """, (
                roll_no, student["parent_phone"], message, session_id, send_date,
                hod_username, gateway_id, routing_error,
            ))
            if cur.rowcount:
                queued += 1
                if routing_error:
                    audit(c, actor, "SMS_BLOCKED", "sms_queue", f"roll={roll_no}; {routing_error}")

        if queued:
            audit(
                c, actor, "SMS_QUEUED", "attendance_session",
                f"session={session_id}; queued={queued}; skipped_no_phone={skipped}; hod={hod_username or 'UNASSIGNED'}",
            )
        return queued, skipped


def pending_approval_for_hod(hod_username: str, send_date: str | None = None):
    with connect() as c:
        if send_date:
            return c.execute("""
                SELECT q.*, s.name AS student_name, g.gateway_name, g.gateway_mode, g.active AS gateway_active
                FROM sms_queue q
                LEFT JOIN students s ON s.roll_no=q.roll_no
                LEFT JOIN sms_gateways g ON g.id=q.gateway_id
                WHERE q.hod_username=%s AND q.send_date=%s AND q.status='PENDING' AND q.approved=0
                ORDER BY q.created_at, q.id
            """, (hod_username, send_date)).fetchall()
        return c.execute("""
            SELECT q.*, s.name AS student_name, g.gateway_name, g.gateway_mode, g.active AS gateway_active
            FROM sms_queue q
            LEFT JOIN students s ON s.roll_no=q.roll_no
            LEFT JOIN sms_gateways g ON g.id=q.gateway_id
            WHERE q.hod_username=%s AND q.status='PENDING' AND q.approved=0
            ORDER BY q.send_date DESC, q.created_at, q.id
            LIMIT 200
        """, (hod_username,)).fetchall()


def approve_sms_batch(hod_username: str, send_date: str, actor: str):
    """Approve a whole HOD/day batch only after routing is valid.

    A row that was created without a gateway can be safely repaired only to
    the currently configured gateway of the *same HOD*. Existing rows with a
    different gateway are never silently rerouted.
    """
    with connect() as c:
        rows = c.execute("""
            SELECT q.id, q.gateway_id, q.error, g.active, g.gateway_mode,
                   g.device_id, g.username, g.password, g.local_url, g.modem_port
            FROM sms_queue q
            LEFT JOIN sms_gateways g ON g.id=q.gateway_id
            WHERE q.hod_username=%s AND q.send_date=%s AND q.status='PENDING' AND q.approved=0
            FOR UPDATE
        """, (hod_username, send_date)).fetchall()
        if not rows:
            return 0

        active_gateway = c.execute(
            "SELECT * FROM sms_gateways WHERE hod_username=%s AND active=1",
            (hod_username,),
        ).fetchone()

        for row in rows:
            gateway = None
            if row["gateway_id"]:
                gateway = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (row["gateway_id"],)).fetchone()
            elif active_gateway:
                # No gateway existed at queue time. Assigning the current
                # gateway for the same HOD is safe and deterministic.
                gateway = active_gateway
                c.execute("UPDATE sms_queue SET gateway_id=%s WHERE id=%s", (gateway["id"], row["id"]))

            if not gateway or not gateway["active"]:
                raise ValueError("Cannot approve this batch: one or more messages have no active gateway for their HOD scope.")

            mode = (gateway.get("gateway_mode") or "").lower()
            valid = True
            reason = None
            if mode == "cloud":
                valid = bool(gateway.get("device_id") and gateway.get("username") and gateway.get("password"))
                if not valid:
                    reason = "Cloud gateway is missing device ID or credentials."
            elif mode == "local":
                valid = bool(gateway.get("local_url"))
                if not valid:
                    reason = "Local gateway URL is missing."
            elif mode == "modem":
                valid = bool(gateway.get("modem_port"))
                if not valid:
                    reason = "Modem port is missing."
            else:
                valid = False
                reason = f"Unsupported SMS gateway mode: {mode or 'empty'}."
            if not valid:
                c.execute("UPDATE sms_queue SET error=%s WHERE id=%s", (reason, row["id"]))
                raise ValueError(f"Cannot approve this batch: {reason}")

        ids = [r["id"] for r in rows]
        placeholders = ",".join("%s" for _ in ids)
        c.execute(
            f"UPDATE sms_queue SET approved=1,error=NULL WHERE id IN ({placeholders}) AND status='PENDING' AND approved=0",
            ids,
        )
        audit(c, actor, "SMS_BATCH_APPROVED", "sms_queue", f"hod={hod_username}; date={send_date}; count={len(ids)}")
        return len(ids)


def pending_sms(limit=25, hod_username=None):
    """Atomically claim approved queue rows so concurrent workers cannot send twice."""
    _recover_stale_processing()
    claimed = []
    with connect() as c:
        if hod_username:
            candidates = c.execute("""
                SELECT id FROM sms_queue
                WHERE status='PENDING' AND approved=1 AND hod_username=%s
                ORDER BY created_at, id
                LIMIT %s
            """, (hod_username, limit)).fetchall()
        else:
            candidates = c.execute("""
                SELECT id FROM sms_queue
                WHERE status='PENDING' AND approved=1
                ORDER BY created_at, id
                LIMIT %s
            """, (limit,)).fetchall()
        for candidate in candidates:
            cur = c.execute("""
                UPDATE sms_queue
                SET status='PROCESSING', attempt_count=attempt_count+1,
                    processing_started_at=CURRENT_TIMESTAMP
                WHERE id=%s AND status='PENDING' AND approved=1
            """, (candidate["id"],))
            if cur.rowcount:
                row = c.execute("SELECT * FROM sms_queue WHERE id=%s", (candidate["id"],)).fetchone()
                if row:
                    claimed.append(row)
    return claimed


def _recover_stale_processing():
    with connect() as c:
        c.execute("""
            UPDATE sms_queue
            SET status='PENDING', processing_started_at=NULL,
                error=COALESCE(error, 'Recovered stale worker lease')
            WHERE status='PROCESSING'
              AND processing_started_at IS NOT NULL
              AND processing_started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL %s MINUTE)
              AND attempt_count < %s
        """, (PROCESSING_LEASE_MINUTES, MAX_ATTEMPTS))


def mark_sent(sms_id, provider_message_id=None, actor="system"):
    with connect() as c:
        row = c.execute("SELECT roll_no FROM sms_queue WHERE id=%s", (sms_id,)).fetchone()
        c.execute("""
            UPDATE sms_queue
            SET status='SENT', sent_at=CURRENT_TIMESTAMP, error=NULL,
                processing_started_at=NULL, provider_message_id=COALESCE(%s,provider_message_id)
            WHERE id=%s AND status='PROCESSING'
        """, (provider_message_id, sms_id))
        if row:
            audit(c, actor, "SMS_SENT", "student", row["roll_no"])


def mark_failed(sms_id, error, *, retryable=True, actor="system"):
    with connect() as c:
        row = c.execute("SELECT roll_no,attempt_count FROM sms_queue WHERE id=%s", (sms_id,)).fetchone()
        if not row:
            return
        terminal = (not retryable) or int(row.get("attempt_count") or 0) >= MAX_ATTEMPTS
        if terminal:
            status = "FAILED"
            approved = 0
        else:
            status = "PENDING"
            approved = 1
        c.execute("""
            UPDATE sms_queue
            SET status=%s, approved=%s, error=%s, processing_started_at=NULL
            WHERE id=%s AND status='PROCESSING'
        """, (status, approved, str(error)[:500], sms_id))
        audit(c, actor, "SMS_FAILED" if terminal else "SMS_RETRY_SCHEDULED", "student", f"{row['roll_no']}: {str(error)[:200]}")


def retry_failed_sms(sms_id: int, hod_username: str | None = None, actor="system"):
    """Put one terminally failed row back into the approved queue.

    Routing is never changed here. The existing gateway_id/HOD snapshot is
    retained, so retry cannot accidentally switch a message to another HOD's
    phone.
    """
    with connect() as c:
        row = c.execute(
            "SELECT id,hod_username,gateway_id,status,attempt_count FROM sms_queue WHERE id=%s",
            (sms_id,),
        ).fetchone()
        if not row:
            raise ValueError("SMS queue row not found")
        if hod_username and row.get("hod_username") != hod_username:
            raise ValueError("You cannot retry another HOD's SMS")
        if row.get("status") != "FAILED":
            raise ValueError("Only failed SMS rows can be retried")
        if not row.get("gateway_id"):
            raise ValueError("This SMS has no assigned gateway and cannot be retried")
        c.execute("""
            UPDATE sms_queue
            SET status='PENDING', approved=1, error=NULL, processing_started_at=NULL,
                attempt_count=0
            WHERE id=%s AND status='FAILED'
        """, (sms_id,))
        audit(c, actor, "SMS_RETRY_REQUESTED", "sms_queue", f"id={sms_id}; hod={row.get('hod_username')}")
        return True


def recent_sms(limit=100, hod_username=None):
    with connect() as c:
        where = ""
        params = [limit]
        if hod_username:
            where = "WHERE q.hod_username=%s"
            params = [hod_username, limit]
        return c.execute(f"""
            SELECT q.*, s.name AS student_name, g.gateway_name, g.gateway_mode
            FROM sms_queue q
            LEFT JOIN students s ON s.roll_no=q.roll_no
            LEFT JOIN sms_gateways g ON g.id=q.gateway_id
            {where}
            ORDER BY q.created_at DESC LIMIT %s
        """, params).fetchall()
