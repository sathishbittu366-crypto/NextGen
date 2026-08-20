"""
Phase 1 — Attendance (api/routes_attendance.py)

Covers: staff-only RBAC on every mutating route (the RED_TEAM_FINDINGS.md
regression this file's comments call out), get-or-create session
behavior, LAB session duration_hours=3 override, and the documented
"mark-all-present does not write the DB, only /save does" contract.

# — WHY this file is more read-heavy than write-heavy: attendance
sessions are tied to real semester/subject IDs that vary per deployment.
Tests that need a real subject_id are marked and will skip cleanly if
/api/attendance/setup returns no subjects for the test account, rather
than guessing an ID and producing a confusing failure.
"""
import datetime
from pathlib import Path
import pytest


class TestAttendanceRBAC:
    def test_setup_requires_auth(self, client):
        r = client.get("/api/attendance/setup")
        assert r.status_code == 401

    def test_setup_forbidden_for_student(self, client, student_headers):
        r = client.get("/api/attendance/setup", headers=student_headers)
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"

    def test_open_session_forbidden_for_student(self, client, student_headers):
        r = client.post("/api/attendance/sessions", headers=student_headers, json={
            "attendance_date": "2026-01-01",
            "semester_id": 1,
            "subject_id": 1,
            "session_type": "THEORY",
            "duration_hours": 1,
            "topic": "zzqa probe",
        })
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"

    def test_mark_all_present_requires_auth(self, client):
        r = client.post("/api/attendance/sessions/1/mark-all-present")
        assert r.status_code == 401

    def test_save_forbidden_for_student(self, client, student_headers):
        r = client.post("/api/attendance/sessions/1/save", headers=student_headers, json={"present_roll_nos": []})
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN"


class TestAttendanceSetup:
    def test_setup_returns_expected_shape_for_hod(self, client, hod_headers):
        r = client.get("/api/attendance/setup", headers=hod_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "semesters" in data
        assert "subjects" in data
        assert "today" in data
        assert data["today"] == datetime.date.today().isoformat()

    def test_subjects_for_semester_requires_semester_id_query_param(self, client, hod_headers):
        r = client.get("/api/attendance/subjects", headers=hod_headers)
        assert r.status_code == 422  # FastAPI query validation, not app logic


class TestSessionNotFound:
    def test_get_nonexistent_session_404s(self, client, hod_headers):
        r = client.get("/api/attendance/sessions/999999999", headers=hod_headers)
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "NOT_FOUND"

    def test_save_nonexistent_session_404s(self, client, hod_headers):
        r = client.post("/api/attendance/sessions/999999999/save", headers=hod_headers,
                         json={"present_roll_nos": []})
        assert r.status_code == 404


class TestOpenSessionValidation:
    def test_invalid_subject_id_rejected(self, client, hod_headers):
        r = client.post("/api/attendance/sessions", headers=hod_headers, json={
            "attendance_date": "2026-01-01",
            "semester_id": 1,
            "subject_id": 999999999,
            "session_type": "THEORY",
            "duration_hours": 1,
            "topic": "zzqa probe",
        })
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_missing_body_fields_returns_422(self, client, hod_headers):
        r = client.post("/api/attendance/sessions", headers=hod_headers, json={})
        assert r.status_code == 422


class TestLiveSessionFlow:
    """Needs a real subject_id, so it discovers one from /setup rather
    than guessing. Skips cleanly (not a failure) if the HOD/FACULTY test
    account has no subjects configured — that's a fixture/environment
    gap to fix in .env.test, not a code defect."""

    @pytest.fixture(scope="class")
    def real_subject(self, client, hod_headers):
        r = client.get("/api/attendance/setup", headers=hod_headers)
        subjects = r.json()["data"]["subjects"]
        sem_id = r.json()["data"]["default_semester_id"]
        if not subjects or not sem_id:
            pytest.skip("No subjects/semester configured for TEST_HOD account — cannot exercise live session flow")
        return sem_id, subjects[0]["id"]

    @pytest.fixture(scope="class")
    def opened_session(self, client, hod_headers, real_subject):
        sem_id, subject_id = real_subject
        today = datetime.date.today().isoformat()
        r = client.post("/api/attendance/sessions", headers=hod_headers, json={
            "attendance_date": today,
            "semester_id": sem_id,
            "subject_id": subject_id,
            "session_type": "THEORY",
            "duration_hours": 1,
            "topic": "zzqa automated test session — safe to ignore/delete",
        })
        assert r.status_code == 201, f"Could not open session, cannot continue: {r.text}"
        return r.json()["data"]

    def test_open_session_is_get_or_create_idempotent(self, client, hod_headers, real_subject, opened_session):
        # — Calling with identical params again should return the SAME
        # session id, not create a duplicate (documented get-or-create behavior).
        sem_id, subject_id = real_subject
        today = datetime.date.today().isoformat()
        r = client.post("/api/attendance/sessions", headers=hod_headers, json={
            "attendance_date": today,
            "semester_id": sem_id,
            "subject_id": subject_id,
            "session_type": "THEORY",
            "duration_hours": 1,
            "topic": "zzqa automated test session — safe to ignore/delete",
        })
        assert r.status_code == 201
        assert r.json()["data"]["id"] == opened_session["id"]

    def test_lab_session_forces_duration_3(self, client, hod_headers, real_subject):
        sem_id, subject_id = real_subject
        r = client.post("/api/attendance/sessions", headers=hod_headers, json={
            "attendance_date": datetime.date.today().isoformat(),
            "semester_id": sem_id,
            "subject_id": subject_id,
            "session_type": "LAB",
            "duration_hours": 1,  # deliberately wrong — API must override to 3
            "topic": "zzqa lab duration probe",
        })
        assert r.status_code == 201
        assert r.json()["data"]["duration_hours"] == 3

    def test_get_session_returns_roster_and_editable_flag(self, client, hod_headers, opened_session):
        r = client.get(f"/api/attendance/sessions/{opened_session['id']}", headers=hod_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "roster" in data
        assert "editable" in data
        assert data["present"] + data["absent"] == len(data["roster"])

    def test_mark_all_present_does_not_persist_to_db(self, client, hod_headers, opened_session):
        """# — PROTECT: this is the single most important attendance
        invariant per ENDPOINTS.md §2.3 and the file's own docstring:
        mark-all-present must NOT write the DB. We prove it by calling
        mark-all-present, then re-fetching the session fresh — if the
        write boundary ever regresses (someone routes mark-all-present
        through save_register directly), this test catches it because
        the re-fetched roster would show real DB state as all-present
        even though we never called /save."""
        sid = opened_session["id"]
        before = client.get(f"/api/attendance/sessions/{sid}", headers=hod_headers).json()["data"]
        r = client.post(f"/api/attendance/sessions/{sid}/mark-all-present", headers=hod_headers)
        assert r.status_code == 200
        roster = r.json()["data"]["roster"] if "roster" in r.json()["data"] else r.json()["data"]
        after_refetch = client.get(f"/api/attendance/sessions/{sid}", headers=hod_headers).json()["data"]
        # DB state (fresh GET) must match what it was BEFORE mark-all-present,
        # not the all-present response mark-all-present itself returned.
        assert after_refetch["present"] == before["present"], (
            "mark-all-present appears to have written to the DB — "
            "this violates the single-write-boundary rule (save_register() "
            "must be the only path that persists attendance)."

class TestSemesterHistoryStaticInvariants:
    def test_register_query_has_same_day_history_tiebreak(self):
        source = Path('sms_app/services/attendance_service.py').read_text()
        assert 'newer.effective_from = h.effective_from AND newer.id > h.id' in source

    def test_register_does_not_use_month_only_history_overlap(self):
        source = Path('sms_app/services/attendance_service.py').read_text()
        assert 'h.effective_from <= ss.attendance_date' in source
        assert 'h.effective_to IS NULL OR h.effective_to >= ss.attendance_date' in source
        assert 'h.effective_from <= %s' not in source

    def test_register_rejects_stale_open_history_after_current_semester_changes(self):
        source = Path('sms_app/services/attendance_service.py').read_text()
        # A legacy/stale open history row for semester III must not keep a
        # current semester-IV student inside a semester-III register.
        assert 'h.effective_to IS NOT NULL OR h.semester_id=st.current_semester_id' in source

    def test_current_semester_write_has_single_database_boundary(self):
        import re
        database = Path('database.py').read_text()
        writes = re.findall(r'UPDATE\s+students\s+SET\s+current_semester_id=', database, flags=re.I)
        assert len(writes) == 1

    def test_history_schema_enforces_one_open_row(self):
        source = Path('database.py').read_text()
        assert 'open_roll_no VARCHAR(64) GENERATED ALWAYS AS (IF(effective_to IS NULL, roll_no, NULL)) STORED' in source
        assert 'uq_student_semester_history_one_open' in source
