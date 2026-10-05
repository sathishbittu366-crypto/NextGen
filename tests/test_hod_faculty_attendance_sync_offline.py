import asyncio


import database
from api.deps import CurrentUser
from api import routes_faculty as rf
from sms_app.services import attendance_service as ats


class Result:
    def __init__(self, rows=None, rowcount=1, lastrowid=99):
        self.rows = list(rows or [])
        self.rowcount = rowcount
        self.lastrowid = lastrowid

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return list(self.rows)


class ReconcileConnection:
    def __init__(self, *, multiple_hods=False):
        hods = [
            {"username": "srikanthhod", "role": "HOD", "active": 1, "full_name": "Srikanth", "department": "CSD"}
        ]
        if multiple_hods:
            hods.append({"username": "otherhod", "role": "HOD", "active": 1, "full_name": "Other HOD", "department": "CSD"})
        self.hods = hods
        self.faculty = {
            "id": 392,
            "username": "Srikanth",
            "role": "FACULTY",
            "active": 1,
            "full_name": "Srikanth",
            "department": "CSD",
            "hod_username": None,
            "faculty_proxy_hod_username": None,
        }
        self.updates = []

    def execute(self, sql, params=()):
        normalized = " ".join(str(sql).split()).lower()
        self.updates.append((normalized, params))
        if normalized.startswith("update users set hod_username=case"):
            return Result(rowcount=1)
        if normalized.startswith("select username, role, active, full_name, department from users"):
            return Result(self.hods)
        if normalized.startswith("select id, username, role, active, full_name, department,"):
            return Result([dict(self.faculty)])
        if normalized.startswith("update users set department=coalesce(nullif(trim(department),''), %s), faculty_proxy_hod_username=%s"):
            self.faculty["department"] = self.faculty.get("department") or params[0]
            self.faculty["faculty_proxy_hod_username"] = params[1]
            return Result(rowcount=1)
        if normalized.startswith("update users set hod_username=%s, department=coalesce(nullif(trim(department),''), %s), faculty_proxy_hod_username=%s"):
            self.faculty["hod_username"] = params[0]
            self.faculty["department"] = self.faculty.get("department") or params[1]
            self.faculty["faculty_proxy_hod_username"] = params[2]
            return Result(rowcount=1)
        if normalized.startswith("update users set hod_username=%s, department=coalesce"):
            self.faculty["hod_username"] = params[0]
            if not self.faculty.get("department"):
                self.faculty["department"] = params[1]
            return Result(rowcount=1)
        if normalized.startswith("update users set faculty_proxy_hod_username=null"):
            self.faculty["faculty_proxy_hod_username"] = None
            return Result(rowcount=1)
        if normalized.startswith("update students") or normalized.startswith("update attendance_sessions"):
            return Result(rowcount=0)
        raise AssertionError(f"Unexpected SQL in reconciliation test: {normalized}")


def test_reconcile_materializes_srikanth_faculty_proxy_without_deleting_history():
    c = ReconcileConnection()
    database.reconcile_hod_scopes(c)
    assert c.faculty["hod_username"] == "srikanthhod"
    assert c.faculty["faculty_proxy_hod_username"] == "srikanthhod"
    assert c.faculty["id"] == 392
    assert any("update users" in sql for sql, _ in c.updates)


def test_reconcile_fails_closed_when_multiple_hods_share_department_and_identity():
    c = ReconcileConnection(multiple_hods=True)
    c.hods[1]["full_name"] = "Srikanth"
    database.reconcile_hod_scopes(c)
    assert c.faculty["hod_username"] is None
    assert c.faculty["faculty_proxy_hod_username"] is None
    assert not any(sql.startswith("update users set hod_username=%s") for sql, _ in c.updates)


def test_reconcile_recovers_same_person_proxy_even_with_multiple_department_hods():
    class MultiIdentityConnection(ReconcileConnection):
        def __init__(self):
            super().__init__(multiple_hods=True)
            self.hods[1]["full_name"] = "Other HOD"

    c = MultiIdentityConnection()
    database.reconcile_hod_scopes(c)
    assert c.faculty["hod_username"] == "srikanthhod"
    assert c.faculty["faculty_proxy_hod_username"] == "srikanthhod"


def test_faculty_page_scope_is_hod_owner(monkeypatch):
    class FacultyPageConnection:
        def __init__(self):
            self.sql_calls = []

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            self.sql_calls.append((normalized, params))
            if normalized.startswith("select id, username, full_name, role, department, hod_username,"):
                return Result([{
                    "id": 392,
                    "username": "Srikanth",
                    "full_name": "Srikanth",
                    "role": "FACULTY",
                    "department": "CSD",
                    "hod_username": "srikanthhod",
                    "designation": "Faculty",
                    "email": None,
                    "phone": None,
                    "active": 1,
                    "must_change_password": 0,
                    "student_roll_no": None,
                }])
            return Result([])

    fake = FacultyPageConnection()
    monkeypatch.setattr(rf, "connect", lambda: fake)
    monkeypatch.setattr(rf, "reconcile_hod_scopes", lambda c: None)
    monkeypatch.setattr(rf, "faculty_teaching_hours", lambda: [])
    monkeypatch.setattr(rf, "subject_faculty_map", lambda: [])
    monkeypatch.setattr(rf, "get_all_role_permissions", lambda: [])

    response = asyncio.run(rf.faculty_page(CurrentUser("srikanthhod", "HOD", None, department="CSD")))
    import json
    payload = json.loads(response.body)
    assert payload["data"]["accounts"][0]["username"] == "Srikanth"
    query, params = next((sql, params) for sql, params in fake.sql_calls if "from users" in sql and "where role='faculty'" in sql)
    assert "lower(trim(coalesce(hod_username,'')))=lower(trim(%s))" in query
    assert "lower(trim(coalesce(department,'')))=lower(trim(%s))" not in query
    assert params == ("srikanthhod",)


def test_create_user_for_hod_faculty_login_persists_explicit_proxy(monkeypatch):
    class CreateConn:
        def __init__(self):
            self.sql_calls = []

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            self.sql_calls.append((normalized, params))
            if normalized.startswith("select username,role,hod_username,department,full_name,active from users"):
                return Result([{
                    "username": "srikanthhod", "role": "HOD", "hod_username": "srikanthhod",
                    "department": "CSD", "full_name": "Srikanth", "active": 1,
                }])
            return Result([], lastrowid=392)

    fake = CreateConn()
    monkeypatch.setattr(database, "connect", lambda: fake)
    monkeypatch.setattr(database, "_hash_password", lambda password: "HASH")
    monkeypatch.setattr(database, "_save_custom_user_backup", lambda *args, **kwargs: None)
    monkeypatch.setattr(database, "audit", lambda *args, **kwargs: None)
    database.create_user("Srikanth", "strong-password", "FACULTY", "Srikanth", actor="srikanthhod")
    insert_sql, params = next((sql, params) for sql, params in fake.sql_calls if sql.startswith("insert into users"))
    assert "faculty_proxy_hod_username" in insert_sql
    assert params[5] == "srikanthhod"
    assert params[6] == "srikanthhod"
    assert params[7] == "CSD"


def test_explicit_proxy_rejects_cross_department_hod_scope():
    class ProxyConnection:
        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            if normalized.startswith("select username, role, hod_username, faculty_proxy_hod_username"):
                return Result([{"username": "FacultyA", "role": "FACULTY", "hod_username": "hod-a",
                                 "faculty_proxy_hod_username": "hod-b", "full_name": "Faculty A", "department": "CSD"}])
            if normalized.startswith("select username, full_name, department from users"):
                return Result([{"username": "hod-b", "full_name": "Other HOD", "department": "ECE"}])
            return Result([])

    assert ats.faculty_proxy_hod_username(ProxyConnection(), "FacultyA") is None


def test_recreate_faculty_account_repairs_proxy_and_preserves_row(monkeypatch):
    class RecreateConn:
        def __init__(self):
            self.sql_calls = []
            self.target = {
                "id": 392, "username": "Srikanth", "role": "FACULTY", "hod_username": None,
                "department": None, "full_name": "Srikanth", "faculty_proxy_hod_username": None,
            }

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            self.sql_calls.append((normalized, params))
            if normalized.startswith("select username,role,department,full_name from users"):
                return Result([{"username": "srikanthhod", "role": "HOD", "department": "CSD", "full_name": "Srikanth"}])
            if normalized.startswith("select * from users where username="):
                return Result([dict(self.target)])
            if normalized.startswith("select username from users where username=%s and role='hod' and active=1"):
                return Result([{"username": "srikanthhod"}])
            if normalized.startswith("update users set password=%s"):
                return Result(rowcount=1)
            if normalized.startswith("insert into audit_logs"):
                return Result(rowcount=1)
            raise AssertionError(f"Unexpected SQL in recreate test: {normalized}")

    fake = RecreateConn()
    monkeypatch.setattr(database, "connect", lambda: fake)
    monkeypatch.setattr(database, "_hash_password", lambda password: "HASH")
    monkeypatch.setattr(database, "audit", lambda *args, **kwargs: None)
    result = database.recreate_faculty_account("Srikanth", "strong-password", "srikanthhod")
    assert result["faculty_proxy_hod_username"] == "srikanthhod"
    update_sql, params = next((sql, params) for sql, params in fake.sql_calls if sql.startswith("update users set password=%s"))
    assert "faculty_proxy_hod_username=%s" in update_sql
    assert params[4] == "srikanthhod"
    assert params[-1] == 392


def test_auth_accepts_dedicated_faculty_login(monkeypatch):
    class AuthConn:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, params=()):
            return Result([{
                "username": "Srikanth", "password": "HASH", "role": "FACULTY", "active": 1,
                "hod_username": "srikanthhod", "department": "CSD",
            }])

    monkeypatch.setattr(database, "connect", lambda: AuthConn())
    monkeypatch.setattr(database, "_verify_password", lambda password, password_hash: True)
    assert database.auth("Srikanth", "strong-password")["role"] == "FACULTY"


class MonthlyRegisterConnection:
    def __init__(self):
        self.sql_calls = []
        self.sessions = [
            {"id": 701, "attendance_date": "2026-09-18", "session_type": "CLASS", "duration_hours": 1,
             "topic": "Graphs", "created_at": None, "faculty_username": "srikanthhod", "hod_username": "srikanthhod"},
            {"id": 702, "attendance_date": "2026-09-18", "session_type": "CLASS", "duration_hours": 1,
             "topic": "LEAKED", "created_at": None, "faculty_username": "otherhod", "hod_username": "otherhod"},
        ]
        self.students = [
            {"roll_no": "S1", "name": "Student One", "current_semester_id": 3, "hod_username": "srikanthhod"},
            {"roll_no": "S2", "name": "Student Two", "current_semester_id": 3, "hod_username": "otherhod"},
        ]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, sql, params=()):
        normalized = " ".join(str(sql).split()).lower()
        self.sql_calls.append((normalized, params))
        if normalized.startswith("select username,role,hod_username,full_name,department from users"):
            return Result([{
                "username": "Srikanth", "role": "FACULTY", "hod_username": "srikanthhod",
                "faculty_proxy_hod_username": "srikanthhod", "full_name": "Srikanth", "department": "CSD",
            }])
        if normalized.startswith("select username, role, hod_username, faculty_proxy_hod_username, full_name, department from users"):
            return Result([{"username": "srikanth", "role": "FACULTY", "hod_username": "srikanthhod", "faculty_proxy_hod_username": "srikanthhod", "full_name": "Srikanth", "department": "CSD"}])
        if normalized.startswith("select username, full_name, department from users where username=%s") or normalized.startswith("select username,full_name,department from users where username=%s"):
            return Result([{"username": "srikanthhod", "full_name": "Srikanth", "department": "CSD"}])
        if normalized.startswith("select 1 from subject_faculty"):
            return Result([])
        if "and ((faculty_username=%s) or (faculty_username=%s and lower(coalesce(hod_username,''))=lower(%s)))" in normalized and normalized.startswith("select 1 from attendance_sessions"):
            return Result([{"id": 701}])
        if normalized.startswith("select s.id,s.code,s.name,s.semester_id,sem.code as semester_code"):
            return Result([{"id": 1, "code": "CS01", "name": "Data Structures", "semester_id": 3, "semester_code": "III-I", "semester_name": "III B.Tech I Semester", "active": 1}])
        if normalized.startswith("select id,attendance_date,session_type,duration_hours,topic,created_at,faculty_username from attendance_sessions"):
            faculty = params[4]
            proxy = params[5]
            proxy_scope = params[6]
            return Result([
                s for s in self.sessions
                if s["faculty_username"].casefold() == faculty.casefold()
                or (s["faculty_username"].casefold() == proxy.casefold() and s["hod_username"].casefold() == proxy_scope.casefold())
            ])
        if normalized.startswith("select holiday_date, holiday_name from academic_holidays"):
            return Result([])
        if normalized.startswith("select distinct st.roll_no, st.name, st.current_semester_id"):
            hod_scope = params[0]
            actor = params[1]
            assert hod_scope.casefold() == "srikanthhod"
            assert actor.casefold() == "srikanth"
            return Result([s for s in self.students if s["hod_username"].casefold() == hod_scope.casefold()])
        if normalized.startswith("select session_id,roll_no,status from attendance_records"):
            return Result([{"session_id": 701, "roll_no": "S1", "status": "Present"}])
        raise AssertionError(f"Unexpected SQL in monthly register test: {normalized}")


def test_monthly_register_shows_imported_hod_session_to_faculty_proxy_without_leakage(monkeypatch):
    fake = MonthlyRegisterConnection()
    monkeypatch.setattr(ats, "connect", lambda: fake)
    result = ats.month_register(faculty_username="Srikanth", semester_id=3, subject_id=1, year=2026, month=9)
    assert result["stats"]["total_sessions"] == 1
    student = result["roster"][0]
    assert student["roll_no"] == "S1"
    assert student["cells"][17]["status"] == "P"
    assert all(r["roll_no"] != "S2" for r in result["roster"])
    session_queries = [
        (sql, params) for sql, params in fake.sql_calls
        if sql.startswith("select id,attendance_date,session_type")
    ]
    assert session_queries
    assert session_queries[0][1][5:] == ("srikanthhod", "srikanthhod")
    assert 702 not in result["days"][17]["session_ids"]


def test_proxy_session_adoption_prevents_duplicate_attendance_session(monkeypatch):
    class SessionConn:
        def __init__(self):
            self.inserts = 0
            self.calls = []

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            self.calls.append((normalized, params))
            if normalized.startswith("select username, role, department, hod_username from users"):
                return Result([{
                    "username": "Srikanth", "role": "FACULTY", "department": "CSD", "hod_username": "srikanthhod"
                }])
            if normalized.startswith("select username, role, hod_username, faculty_proxy_hod_username"):
                return Result([{
                    "username": "Srikanth", "role": "FACULTY", "hod_username": "srikanthhod",
                    "faculty_proxy_hod_username": "srikanthhod", "full_name": "Srikanth", "department": "CSD"
                }])
            if normalized.startswith("select username, full_name, department from users where username=%s"):
                return Result([{"username": "srikanthhod", "full_name": "Srikanth", "department": "CSD"}])
            if normalized.startswith("select 1 from subject_faculty"):
                return Result([])
            if normalized.startswith("select * from attendance_sessions where attendance_date=%s and subject_id=%s and faculty_username=%s"):
                return Result([])
            if "faculty_username=%s and lower(coalesce(hod_username,''))=lower(%s)" in normalized:
                return Result([{
                    "id": 701, "attendance_date": "2026-09-18", "semester_id": 3, "subject_id": 1,
                    "faculty_username": "srikanthhod", "hod_username": "srikanthhod", "session_type": "CLASS",
                    "duration_hours": 1, "topic": "Graphs", "created_by": "srikanthhod"
                }])
            if normalized.startswith("insert into attendance_sessions"):
                self.inserts += 1
                raise AssertionError("Faculty proxy created a duplicate attendance session")
            raise AssertionError(f"Unexpected SQL in duplicate test: {normalized}")

    fake = SessionConn()
    monkeypatch.setattr(ats, "connect", lambda: fake)
    row = ats.get_or_create_session(
        attendance_date="2026-09-18", semester_id=3, subject_id=1,
        faculty_username="Srikanth", session_type="CLASS", duration_hours=1,
        topic="Graphs", actor="Srikanth", connection=fake,
    )
    assert row["id"] == 701
    assert fake.inserts == 0


def test_set_subject_faculty_rejects_cross_hod_selection(monkeypatch):
    class SubjectConn:
        def __init__(self):
            self.calls = []
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False
        def execute(self, sql, params=()):
            normalized = " ".join(str(sql).split()).lower()
            self.calls.append((normalized, params))
            if normalized.startswith("select * from subjects where id="):
                return Result([{"id": 7, "code": "24CS512PE", "name": "Elective"}])
            if normalized.startswith("select username from users where role='faculty' and active=1"):
                if "hod_username" in normalized:
                    return Result([])
                return Result([{"username": "FacultyA"}])
            return Result([])

    fake = SubjectConn()
    monkeypatch.setattr(ats, "connect", lambda: fake)
    try:
        ats.set_subject_faculty(
            subject_id=7,
            faculty_usernames=["FacultyA"],
            actor="hod-a",
            scope_hod_username="hod-a",
        )
    except ValueError as exc:
        assert "outside your HOD scope" in str(exc)
    else:
        raise AssertionError("cross-HOD Faculty selection must be rejected")
