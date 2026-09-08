from __future__ import annotations

import pytest

from sms_app.services import sms_access


class _Result:
    rowcount = 1
    lastrowid = 1

    def __init__(self, rows=None, row=None):
        self._rows = rows or []
        self._row = row

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows


class _Conn:
    """Fake connection covering both set_faculty_sms_access and
    set_batch_handler query shapes, so both entry points can be exercised
    against the same in-memory delegation state within one test.
    """

    def __init__(self, faculty=None, semesters=None, hod_username="csdhod"):
        self.faculty = faculty or {}
        self.semesters = set(semesters or [])
        self.hod_username = hod_username
        self.access = {}
        self.delegations = set()  # {(faculty_username, hod_username, semester_id)}
        self.executed = []

    def execute(self, sql, params=()):
        self.executed.append((sql, params))
        q = " ".join(sql.split()).lower()

        if q.startswith("select username, full_name, role, department, hod_username, active from users"):
            return _Result(row=self.faculty.get(params[0]))

        # set_faculty_sms_access's in-scope batch check (multi-id IN clause)
        if q.startswith("select sem.id from academic_semesters"):
            requested = {int(x) for x in params[:-1]}
            return _Result(rows=[{"id": x} for x in sorted(requested & self.semesters)])

        # set_batch_handler's in-scope single-batch check
        if q.startswith("select 1 from academic_semesters"):
            semester_id = int(params[0])
            return _Result(row={"1": 1} if semester_id in self.semesters else None)

        if q.startswith("insert into sms_gateway_access"):
            faculty, hod, enabled, _, _ = params
            self.access[faculty] = {"hod_username": hod, "enabled": enabled}
            return _Result()

        if q.startswith("select faculty_username, hod_username, enabled from sms_gateway_access"):
            faculty = params[0]
            row = self.access.get(faculty)
            return _Result(row={"faculty_username": faculty, **row} if row else None)

        # set_faculty_sms_access clears by faculty; set_batch_handler clears by semester
        if q.startswith("delete from sms_gateway_batch_delegations where faculty_username=%s"):
            faculty = params[0]
            self.delegations = {d for d in self.delegations if d[0] != faculty}
            return _Result()
        if q.startswith("delete from sms_gateway_batch_delegations where semester_id=%s"):
            semester_id = int(params[0])
            self.delegations = {d for d in self.delegations if d[2] != semester_id}
            return _Result()

        if q.startswith("insert into sms_gateway_batch_delegations"):
            faculty, hod, semester_id = params
            self.delegations.add((faculty, hod, int(semester_id)))
            return _Result()

        raise AssertionError(f"Unhandled SQL: {sql}")


@pytest.fixture(autouse=True)
def _no_audit(monkeypatch):
    monkeypatch.setattr("database.audit", lambda *args, **kwargs: None)


def test_self_assign_clears_existing_faculty_delegation():
    conn = _Conn(
        faculty={"naveen": {"username": "naveen", "role": "FACULTY", "hod_username": "csdhod", "active": 1}},
        semesters=[10],
    )
    conn.access["naveen"] = {"hod_username": "csdhod", "enabled": 1}
    conn.delegations = {("naveen", "csdhod", 10)}

    sms_access.set_batch_handler(conn, hod_username="csdhod", semester_id=10, handler_username="csdhod", actor="csdhod")

    # Self-assignment is represented by the absence of a delegation row.
    assert conn.delegations == set()


def test_assign_to_faculty_requires_enabled_access():
    conn = _Conn(
        faculty={"naveen": {"username": "naveen", "role": "FACULTY", "hod_username": "csdhod", "active": 1}},
        semesters=[10],
    )
    with pytest.raises(ValueError, match="Enable SMS Gateway access"):
        sms_access.set_batch_handler(conn, hod_username="csdhod", semester_id=10, handler_username="naveen", actor="csdhod")
    assert conn.delegations == set()


def test_assign_to_faculty_takes_over_batch_from_previous_handler():
    conn = _Conn(
        faculty={
            "naveen": {"username": "naveen", "role": "FACULTY", "hod_username": "csdhod", "active": 1},
            "priya": {"username": "priya", "role": "FACULTY", "hod_username": "csdhod", "active": 1},
        },
        semesters=[10],
    )
    conn.access["naveen"] = {"hod_username": "csdhod", "enabled": 1}
    conn.access["priya"] = {"hod_username": "csdhod", "enabled": 1}
    conn.delegations = {("naveen", "csdhod", 10)}

    sms_access.set_batch_handler(conn, hod_username="csdhod", semester_id=10, handler_username="priya", actor="csdhod")

    assert conn.delegations == {("priya", "csdhod", 10)}


def test_cannot_assign_batch_outside_hod_scope():
    conn = _Conn(semesters=[10])
    with pytest.raises(ValueError, match="outside your HOD scope"):
        sms_access.set_batch_handler(conn, hod_username="csdhod", semester_id=99, handler_username="csdhod", actor="csdhod")


def test_cannot_assign_to_faculty_from_another_hod_scope():
    conn = _Conn(
        faculty={"naveen": {"username": "naveen", "role": "FACULTY", "hod_username": "otherhod", "active": 1}},
        semesters=[10],
    )
    conn.access["naveen"] = {"hod_username": "otherhod", "enabled": 1}
    with pytest.raises(ValueError, match="outside your HOD scope"):
        sms_access.set_batch_handler(conn, hod_username="csdhod", semester_id=10, handler_username="naveen", actor="csdhod")


def test_reassigning_via_faculty_flow_takes_batch_back_from_self_assignment():
    """set_faculty_sms_access (the existing Faculty-centric panel) must also
    win a batch away from a self-assignment, not just from other Faculty."""
    conn = _Conn(
        faculty={"naveen": {"username": "naveen", "role": "FACULTY", "hod_username": "csdhod", "active": 1}},
        semesters=[10],
    )
    # semester 10 currently has no delegation row at all == self-assigned to HOD.
    sms_access.set_faculty_sms_access(conn, hod_username="csdhod", faculty_username="naveen", enabled=True, batch_ids=[10], actor="csdhod")
    assert conn.delegations == {("naveen", "csdhod", 10)}
