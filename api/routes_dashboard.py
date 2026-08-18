"""Group 2 — Dashboard API. OPTION_B_REWRITE_PLAN.md §2 group 2.

Route mapping (old -> new, per plan §3.2 pattern):
  GET /dashboard           -> GET /api/dashboard          (role-aware)
  GET /attendance-session/{id}/present -> GET /api/dashboard/session/{id}/present
  GET /attendance-session/{id}/absent  -> GET /api/dashboard/session/{id}/absent
  GET /audit-log           -> GET /api/dashboard/audit-log
  GET /sms-log             -> GET /api/dashboard/sms-log
  (new, STUDENT-only)      -> GET /api/dashboard/student/subject/{id}/history
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from database import connect
from sms_app.services.attendance_service import (
    absent_students_for_session,
    attendance_pct_band,
    present_students_for_session,
    session_details,
    sessions_last_n_days,
    student_subject_attendance,
    student_subject_session_history,
)

from api.deps import CurrentUser, get_current_user
from api.envelope import ApiError, ok

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _serialize_session_row(r) -> dict:
    """Convert a row from sessions_last_n_days() to a JSON-safe dict."""
    return {
        "id":             r["id"],
        "attendance_date": r["attendance_date"],
        "session_type":   r["session_type"],
        "duration_hours": r["duration_hours"],
        "created_at":     r["created_at"],
        "topic":          r["topic"] if "topic" in r.keys() else None,
        "subject_name":   r["subject_name"],
        "subject_code":   r["subject_code"],
        "faculty_name":   r["faculty_name"],
        "faculty_username": r["faculty_username"],
        "semester_code":  r["semester_code"] if "semester_code" in r.keys() else None,
        "semester_name":  r["semester_name"] if "semester_name" in r.keys() else None,
        "absent_count":   r["absent_count"],
        "present_count":  r["present_count"],
        "total_marked":   r["total_marked"],
    }


# ──────────────────────────────────────────────
# GET /api/dashboard
# ──────────────────────────────────────────────

@router.get("")
async def dashboard(
    date: str | None = Query(default=None, description="YYYY-MM-DD — filter HOD view to a single day"),
    semester_id: int | None = Query(default=None, description="Filter HOD view to a single semester"),
    year: str | None = Query(default=None, description="Academic year: 1, 2, 3, or 4"),
    user: CurrentUser = Depends(get_current_user),
):
    """Role-aware dashboard root."""
    if user.role == "FACULTY":
        return ok({"role": "FACULTY", "redirect": "/attendance"})

    if user.role == "STUDENT":
        return await _student_dashboard(user)

    # HOD / ADMIN
    return await _hod_dashboard(user, picked_date=date, picked_semester_id=semester_id, picked_year=year)


async def _hod_dashboard(user: CurrentUser, picked_date: str | None, picked_semester_id: int | None = None, picked_year: str | None = None) -> dict:
    grouped_raw = sessions_last_n_days(15, on_date=picked_date, semester_id=picked_semester_id, year=picked_year, hod_username=user.username if user.role == "HOD" else None)
    days: dict[str, list[dict]] = {
        date_str: [_serialize_session_row(r) for r in rows]
        for date_str, rows in grouped_raw.items()
    }
    return ok({
        "role":               user.role,
        "scope_hod_username": user.username if user.role == "HOD" else None,
        "days":               days,
        "picked_date":        picked_date,
        "picked_semester_id": picked_semester_id,
        "picked_year":        picked_year,
    })


async def _student_dashboard(user: CurrentUser) -> dict:
    with connect() as c:
        s = c.execute(
            "SELECT roll_no, name, department FROM students WHERE roll_no=?",
            (user.student_roll_no,),
        ).fetchone()

    if not s:
        raise ApiError(
            "Your student record was not found. Contact HOD.",
            status_code=404,
            code="STUDENT_NOT_FOUND",
        )

    rows = student_subject_attendance(user.student_roll_no)
    subjects = []
    for r in rows:
        pct, band = attendance_pct_band(r["present_sessions"], r["total_sessions"])
        subjects.append({
            "subject_id":   r["subject_id"],
            "code":         r["subject_code"],
            "name":         r["subject_name"],
            "pct":          pct,
            "band":         band,
            "total":        r["total_sessions"],
            "present":      r["present_sessions"],
        })

    return ok({
        "role":    "STUDENT",
        "student": {"roll_no": s["roll_no"], "name": s["name"], "department": s["department"]},
        "subjects": subjects,
    })


# ──────────────────────────────────────────────
# Session drill-downs (HOD / FACULTY)
# ──────────────────────────────────────────────

@router.get("/session/{session_id}/present")
async def session_present(
    session_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    if user.role not in ("HOD", "FACULTY"):
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    sess = session_details(session_id)
    if not sess:
        raise ApiError("Session not found", status_code=404, code="NOT_FOUND")
    rows = present_students_for_session(session_id)
    return ok({
        "session": {
            "id":              sess["id"],
            "subject_name":    sess["subject_name"],
            "attendance_date": sess["attendance_date"],
            "session_type":    sess["session_type"],
        },
        "students": [{"roll_no": r["roll_no"], "name": r["name"]} for r in rows],
        "kind": "present",
    })


@router.get("/session/{session_id}/absent")
async def session_absent(
    session_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    if user.role not in ("HOD", "FACULTY"):
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    sess = session_details(session_id)
    if not sess:
        raise ApiError("Session not found", status_code=404, code="NOT_FOUND")
    rows = absent_students_for_session(session_id)
    return ok({
        "session": {
            "id":              sess["id"],
            "subject_name":    sess["subject_name"],
            "attendance_date": sess["attendance_date"],
            "session_type":    sess["session_type"],
        },
        "students": [{"roll_no": r["roll_no"], "name": r["name"]} for r in rows],
        "kind": "absent",
    })


# ──────────────────────────────────────────────
# Student subject session history
# ──────────────────────────────────────────────

@router.get("/student/subject/{subject_id}/history")
async def student_subject_history(
    subject_id: int,
    user: CurrentUser = Depends(get_current_user),
):
    if user.role != "STUDENT":
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    if not user.student_roll_no:
        raise ApiError(
            "Your student record was not found. Contact HOD.",
            status_code=404,
            code="STUDENT_NOT_FOUND",
        )
    rows = student_subject_session_history(user.student_roll_no, subject_id)
    return ok({
        "subject_id": subject_id,
        "sessions": [
            {
                "attendance_date": r["attendance_date"],
                "session_type":   r["session_type"],
                "duration_hours": r["duration_hours"],
                "status":         r["status"],
            }
            for r in rows
        ],
    })


# ──────────────────────────────────────────────
# Audit Log & SMS Log (HOD only)
# ──────────────────────────────────────────────

@router.get("/audit-log")
async def audit_log_endpoint(user: CurrentUser = Depends(get_current_user)):
    if user.role != "HOD":
        raise ApiError("HOD access only", status_code=403, code="FORBIDDEN")
    from sms_app.services.attendance_service import recent_audit_logs
    rows = recent_audit_logs(150)
    return ok([dict(r) for r in rows])


@router.get("/sms-log")
async def sms_log_endpoint(user: CurrentUser = Depends(get_current_user)):
    if user.role != "HOD":
        raise ApiError("HOD access only", status_code=403, code="FORBIDDEN")
    from sms_app.services.sms_service import recent_sms
    rows = recent_sms(150, hod_username=user.username if user.role == "HOD" else None)
    return ok([dict(r) for r in rows])


from datetime import datetime
from pydantic import BaseModel, Field

from database import get_setting, set_setting
from field_encryption import encrypt_field, decrypt_field, looks_encrypted


class SmsSettingsBody(BaseModel):
    sms_enabled: str = "0"
    sms_daily_cap: str = "62"


class SmsTestBody(BaseModel):
    phone: str
    message: str = "Dear Parent, Student is absent for class today (Database Systems, 2026-07-30). - VCET CSD Data Science Dept"
    gateway_id: int | None = None


class SmsGatewayBody(BaseModel):
    hod_username: str | None = None
    gateway_name: str = "SMSGate Phone"
    gateway_mode: str = "cloud"
    device_id: str | None = None
    local_url: str | None = None
    username: str | None = None
    password: str | None = None
    modem_port: str | None = None
    modem_baud: str = "115200"
    sim_number: int | None = Field(default=None, ge=1, le=3)
    active: bool = True


class SmsApprovalBody(BaseModel):
    send_date: str


def _gateway_visible(row) -> dict:
    return {
        "id": row["id"],
        "hod_username": row["hod_username"],
        "gateway_name": row["gateway_name"],
        "gateway_mode": row["gateway_mode"],
        "device_id": row.get("device_id") or "",
        "local_url": row.get("local_url") or "",
        "username": row.get("username") or "",
        "password_set": bool(row.get("password")),
        "modem_port": row.get("modem_port") or "",
        "modem_baud": row.get("modem_baud") or "115200",
        "sim_number": row.get("sim_number"),
        "active": bool(row["active"]),
        "updated_at": row.get("updated_at"),
    }


def _validate_gateway_body(body: SmsGatewayBody) -> None:
    mode = body.gateway_mode.strip().lower()
    if mode not in ("cloud", "local", "modem"):
        raise ApiError("Gateway mode must be cloud, local, or modem", 400, "VALIDATION_ERROR")
    if mode == "cloud":
        if not body.device_id or not body.device_id.strip():
            raise ApiError("Cloud gateway requires a device ID", 400, "VALIDATION_ERROR")
        if not body.username or not body.username.strip():
            raise ApiError("Cloud gateway requires a username", 400, "VALIDATION_ERROR")
        if not body.password or not body.password.strip():
            raise ApiError("Cloud gateway requires a password", 400, "VALIDATION_ERROR")
    elif mode == "local" and not (body.local_url or "").strip():
        raise ApiError("Local gateway requires a local URL", 400, "VALIDATION_ERROR")
    elif mode == "modem" and not (body.modem_port or "").strip():
        raise ApiError("Modem gateway requires a serial port", 400, "VALIDATION_ERROR")


@router.get("/sms-gateways")
async def list_sms_gateways(user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    with connect() as c:
        if user.role == "HOD":
            rows = c.execute("SELECT * FROM sms_gateways WHERE hod_username=%s", (user.username,)).fetchall()
        else:
            rows = c.execute("SELECT * FROM sms_gateways ORDER BY hod_username").fetchall()
    return ok([_gateway_visible(r) for r in rows])


@router.post("/sms-gateways")
async def create_sms_gateway(body: SmsGatewayBody, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    _validate_gateway_body(body)
    hod_username = user.username if user.role == "HOD" else (body.hod_username or "").strip()
    if not hod_username:
        raise ApiError("A responsible HOD is required", 400, "VALIDATION_ERROR")
    with connect() as c:
        hod = c.execute("SELECT username FROM users WHERE username=%s AND role='HOD' AND active=1", (hod_username,)).fetchone()
        if not hod:
            raise ApiError("Responsible HOD is not an active HOD account", 400, "VALIDATION_ERROR")
        existing = c.execute("SELECT id FROM sms_gateways WHERE hod_username=%s", (hod_username,)).fetchone()
        if existing:
            raise ApiError("This HOD already has an SMS gateway. Edit the existing gateway instead.", 409, "GATEWAY_EXISTS")
        cur = c.execute("""
            INSERT INTO sms_gateways(
                hod_username,gateway_name,gateway_mode,device_id,local_url,username,password,
                modem_port,modem_baud,sim_number,active
            ) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            hod_username, body.gateway_name.strip() or "SMSGate Phone", body.gateway_mode.strip().lower(),
            body.device_id, body.local_url, body.username, encrypt_field(body.password),
            body.modem_port, body.modem_baud, body.sim_number, int(body.active),
        ))
        from database import audit
        audit(c, user.username, "CREATE", "sms_gateway", f"hod={hod_username}; gateway={cur.lastrowid}")
        row = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (cur.lastrowid,)).fetchone()
    return ok(_gateway_visible(row), status_code=201)


@router.patch("/sms-gateways/{gateway_id}")
async def update_sms_gateway(gateway_id: int, body: SmsGatewayBody, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    with connect() as c:
        row = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (gateway_id,)).fetchone()
    if not row:
        raise ApiError("SMS gateway not found", 404, "NOT_FOUND")
    if user.role == "HOD" and row["hod_username"] != user.username:
        raise ApiError("You cannot edit another HOD's SMS gateway", 403, "FORBIDDEN")

    # Blank password on edit means keep the current password.
    mode = body.gateway_mode.strip().lower()
    if mode not in ("cloud", "local", "modem"):
        raise ApiError("Gateway mode must be cloud, local, or modem", 400, "VALIDATION_ERROR")
    if mode == "cloud":
        if not (body.device_id or row.get("device_id")):
            raise ApiError("Cloud gateway requires a device ID", 400, "VALIDATION_ERROR")
        if not (body.username or row.get("username")):
            raise ApiError("Cloud gateway requires a username", 400, "VALIDATION_ERROR")
        if not (body.password or row.get("password")):
            raise ApiError("Cloud gateway requires a password", 400, "VALIDATION_ERROR")
    elif mode == "local" and not (body.local_url or row.get("local_url")):
        raise ApiError("Local gateway requires a local URL", 400, "VALIDATION_ERROR")
    elif mode == "modem" and not (body.modem_port or row.get("modem_port")):
        raise ApiError("Modem gateway requires a serial port", 400, "VALIDATION_ERROR")

    with connect() as c:
        c.execute("""
            UPDATE sms_gateways SET
                gateway_name=%s,gateway_mode=%s,device_id=%s,local_url=%s,username=%s,
                password=%s,modem_port=%s,modem_baud=%s,sim_number=%s,active=%s,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=%s
        """, (
            body.gateway_name.strip() or row["gateway_name"], mode,
            body.device_id if body.device_id is not None else row.get("device_id"),
            body.local_url if body.local_url is not None else row.get("local_url"),
            body.username if body.username is not None else row.get("username"),
            encrypt_field(body.password) if body.password else row.get("password"),
            body.modem_port if body.modem_port is not None else row.get("modem_port"),
            body.modem_baud or row.get("modem_baud") or "115200",
            body.sim_number if body.sim_number is not None else row.get("sim_number"),
            int(body.active), gateway_id,
        ))
        from database import audit
        audit(c, user.username, "UPDATE", "sms_gateway", f"gateway={gateway_id}; hod={row['hod_username']}")
        updated = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (gateway_id,)).fetchone()
    return ok(_gateway_visible(updated))


@router.post("/sms-gateways/{gateway_id}/test-connection")
async def test_sms_gateway_connection(gateway_id: int, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    with connect() as c:
        gateway = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (gateway_id,)).fetchone()
    if not gateway:
        raise ApiError("SMS gateway not found", 404, "NOT_FOUND")
    if user.role == "HOD" and gateway["hod_username"] != user.username:
        raise ApiError("You cannot test another HOD's SMS gateway", 403, "FORBIDDEN")
    mode = (gateway.get("gateway_mode") or "").lower()
    try:
        if mode == "cloud":
            from webapp.sms_cloud_gateway import test_cloud_gateway
            device = test_cloud_gateway(gateway.get("username"), decrypt_field(gateway.get("password")), gateway.get("device_id"))
            return ok({"ok": True, "mode": "cloud", "device": device})
        if mode == "local":
            import urllib.request
            url = (gateway.get("local_url") or "").rstrip("/") + "/health"
            with urllib.request.urlopen(url, timeout=8) as resp:
                if resp.getcode() != 200:
                    raise RuntimeError(f"HTTP {resp.getcode()}")
                return ok({"ok": True, "mode": "local", "health": resp.read().decode("utf-8", errors="replace")[:1000]})
        if mode == "modem":
            if not gateway.get("modem_port"):
                raise RuntimeError("Modem port is not configured")
            return ok({"ok": True, "mode": "modem", "message": "Serial port configuration is present. A test SMS was not sent."})
        raise RuntimeError("Unsupported gateway mode")
    except Exception as exc:
        raise ApiError(f"Gateway connection test failed: {exc}", 400, "GATEWAY_TEST_FAILED")


@router.get("/sms-approval")
async def get_sms_approval(send_date: str | None = Query(default=None), user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    from sms_app.services.sms_service import pending_approval_for_hod
    if user.role == "HOD":
        hod_username = user.username
    else:
        # Admin sees all unapproved rows; this keeps the endpoint useful even
        # though the current DB seeds the maintainer account as HOD.
        with connect() as c:
            if send_date:
                rows = c.execute("""
                    SELECT q.*, s.name AS student_name, g.gateway_name, g.gateway_mode, g.active AS gateway_active
                    FROM sms_queue q LEFT JOIN students s ON s.roll_no=q.roll_no
                    LEFT JOIN sms_gateways g ON g.id=q.gateway_id
                    WHERE q.send_date=%s AND q.status='PENDING' AND q.approved=0
                    ORDER BY q.hod_username,q.created_at,q.id
                """, (send_date,)).fetchall()
            else:
                rows = c.execute("""
                    SELECT q.*, s.name AS student_name, g.gateway_name, g.gateway_mode, g.active AS gateway_active
                    FROM sms_queue q LEFT JOIN students s ON s.roll_no=q.roll_no
                    LEFT JOIN sms_gateways g ON g.id=q.gateway_id
                    WHERE q.status='PENDING' AND q.approved=0
                    ORDER BY q.send_date DESC,q.hod_username,q.created_at,q.id LIMIT 500
                """).fetchall()
    if user.role == "HOD":
        rows = pending_approval_for_hod(hod_username, send_date)
    return ok([{
        "id": r["id"], "roll_no": r["roll_no"], "student_name": r.get("student_name") or "",
        "parent_phone": r["parent_phone"], "message": r["message"], "send_date": r["send_date"],
        "hod_username": r.get("hod_username"), "gateway_id": r.get("gateway_id"),
        "gateway_name": r.get("gateway_name"), "gateway_mode": r.get("gateway_mode"),
        "gateway_active": bool(r.get("gateway_active")) if r.get("gateway_active") is not None else False,
        "error": r.get("error"),
    } for r in rows])


@router.post("/sms-approval")
async def approve_sms(body: SmsApprovalBody, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", 403, "FORBIDDEN")
    try:
        datetime.strptime(body.send_date, "%Y-%m-%d")
    except ValueError:
        raise ApiError("send_date must be YYYY-MM-DD", 400, "VALIDATION_ERROR")
    from sms_app.services.sms_service import approve_sms_batch
    if user.role == "HOD":
        hod_username = user.username
        try:
            count = approve_sms_batch(hod_username, body.send_date, user.username)
        except ValueError as exc:
            raise ApiError(str(exc), 400, "SMS_BATCH_BLOCKED")
        return ok({"approved_count": count, "hod_username": hod_username, "send_date": body.send_date})

    # ADMIN can approve all HOD batches for a selected date, but each HOD batch
    # remains atomic and individually validated.
    with connect() as c:
        hods = c.execute("SELECT DISTINCT hod_username FROM sms_queue WHERE send_date=%s AND status='PENDING' AND approved=0 AND hod_username IS NOT NULL", (body.send_date,)).fetchall()
    total = 0
    for row in hods:
        try:
            total += approve_sms_batch(row["hod_username"], body.send_date, user.username)
        except ValueError as exc:
            raise ApiError(str(exc), 400, "SMS_BATCH_BLOCKED")
    return ok({"approved_count": total, "send_date": body.send_date})


@router.get("/sms-settings")
async def get_sms_settings(user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("HOD or Admin access only", status_code=403, code="FORBIDDEN")
    return ok({
        "sms_enabled": get_setting("sms_enabled", "0"),
        "sms_daily_cap": get_setting("sms_daily_cap", "62"),
    })


@router.post("/sms-settings")
async def save_sms_settings(body: SmsSettingsBody, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    if body.sms_enabled not in ("0", "1"):
        raise ApiError("sms_enabled must be 0 or 1", 400, "VALIDATION_ERROR")
    try:
        cap = int(body.sms_daily_cap)
    except ValueError:
        raise ApiError("Daily SMS cap must be a positive integer", 400, "VALIDATION_ERROR")
    if cap <= 0:
        raise ApiError("Daily SMS cap must be a positive integer", 400, "VALIDATION_ERROR")
    set_setting("sms_enabled", body.sms_enabled, actor=user.username)
    set_setting("sms_daily_cap", str(cap), actor=user.username)
    return ok({"ok": True})


@router.post("/sms-test")
async def test_sms_gateway(body: SmsTestBody, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    with connect() as c:
        if body.gateway_id:
            gateway = c.execute("SELECT * FROM sms_gateways WHERE id=%s", (body.gateway_id,)).fetchone()
        elif user.role == "HOD":
            gateway = c.execute("SELECT * FROM sms_gateways WHERE hod_username=%s AND active=1", (user.username,)).fetchone()
        else:
            gateway = None
    if not gateway:
        raise ApiError("Select/configure an active SMS gateway before sending a test SMS", 400, "GATEWAY_NOT_CONFIGURED")
    if user.role == "HOD" and gateway["hod_username"] != user.username:
        raise ApiError("You cannot test another HOD's SMS gateway", 403, "FORBIDDEN")
    from webapp.sms_worker import send_single_sms
    msg = body.message.strip() if body.message and body.message.strip() else "Dear Parent, Student is absent for class today (Database Systems, 2026-07-30). - VCET CSD Data Science Dept"
    try:
        send_single_sms(body.phone, msg, gateway, message_id=None)
        return ok({"sent": True, "message": "Test SMS sent successfully."})
    except Exception as exc:
        raise ApiError(f"Test SMS failed: {exc}", status_code=400, code="SMS_SEND_FAILED")


@router.post("/sms-trigger")
async def trigger_sms_queue(user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("HOD", "ADMIN"):
        raise ApiError("Access denied", status_code=403, code="FORBIDDEN")
    from webapp.sms_worker import process_pending_sms_now
    sent, failed = process_pending_sms_now(hod_username=user.username if user.role == "HOD" else None)
    return ok({"sent_count": sent, "failed_count": failed})
