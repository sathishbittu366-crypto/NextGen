"""Unit tests for assemble_student_result_report — pure logic, no database.

# — WHY: pass/fail, attempt linking and computed CGPA are the numbers a student
# reads as "official". These tests pin the rules so nobody changes them by
# accident. Run on their own with: pytest tests/test_result_report_unit.py --noconftest
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sms_app.services.learning_service import assemble_student_result_report  # noqa: E402


def _sub(code, name, grade, gp, credits, marks=70):
    return {
        "subject_code": code, "subject_name": name, "marks": marks, "max_marks": 100,
        "internal_marks": 20, "external_marks": marks - 20, "credits": credits,
        "grade": grade, "grade_point": gp, "result_status": "", "sgpa": "", "percentage": "",
    }


def _entry(title, sem_code, created, subjects, sgpa="7.5"):
    return {
        "batch": {"id": 1, "title": title, "created_at": created, "source_filename": None,
                  "semester_code": sem_code, "semester_name": f"Sem {sem_code}"},
        "subjects": subjects, "total_credits": 0, "sgpa": sgpa, "result_status": None,
    }


STUDENT = {"roll_no": "R1", "name": "A", "department": "CSD"}


def test_fail_then_clear_keeps_both_attempts_and_links_them():
    regular = _entry("Sem 1 Regular", "S1", "2026-01-01", [
        _sub("M1", "Maths", "F", "0", 0, marks=20),
        _sub("P1", "Physics", "A", "9", 3),
    ])
    supply = _entry("Sem 1 Supply", "S1", "2026-03-01", [_sub("M1", "Maths", "B", "7", 3)], sgpa="")
    rep = assemble_student_result_report(STUDENT, [supply, regular])  # deliberately unordered

    assert [a["batch"]["title"] for a in rep["attempts"]] == ["Sem 1 Regular", "Sem 1 Supply"]
    failed = rep["attempts"][0]["subjects"][0]
    assert failed["status"] == "FAIL" and failed["cleared_in"] == "Sem 1 Supply" and not failed["pending"]
    assert rep["attempts"][1]["subjects"][0]["attempt_no"] == 2
    s = rep["summary"]
    assert (s["subjects_passed"], s["subjects_failed"], s["failed_then_cleared"]) == (2, 1, 1)
    assert s["pending_backlogs"] == []


def test_uncleared_failure_is_pending_and_absent_counts_as_fail():
    e = _entry("Sem 2", "S2", "2026-02-01", [
        _sub("D1", "DBMS", "AB", "0", 0),
        _sub("O1", "OS", "C", "6", 4),
    ])
    rep = assemble_student_result_report(STUDENT, [e])
    pend = rep["summary"]["pending_backlogs"]
    assert [p["subject_code"] for p in pend] == ["D1"]
    assert rep["summary"]["subjects_failed"] == 1


def test_cgpa_uses_latest_pass_per_subject_and_ignores_failed_attempts():
    regular = _entry("R", "S1", "2026-01-01", [
        _sub("M1", "Maths", "F", "0", 0),
        _sub("P1", "Physics", "A", "9", 3),
    ])
    supply = _entry("S", "S1", "2026-03-01", [_sub("M1", "Maths", "B", "7", 3)])
    rep = assemble_student_result_report(STUDENT, [regular, supply])
    # (9*3 + 7*3) / 6 = 8.0 — the failed M1 attempt contributes nothing
    assert rep["summary"]["cgpa"] == 8.0
    assert rep["summary"]["cgpa_computed"] is True
    assert rep["summary"]["credits_earned"] == 6.0


def test_no_results_gives_empty_report_without_cgpa():
    rep = assemble_student_result_report(STUDENT, [])
    assert rep["attempts"] == [] and rep["summary"]["cgpa"] is None
    assert rep["summary"]["pending_backlogs"] == []


def test_missing_grade_and_status_stays_unknown_not_pass():
    e = _entry("X", "S1", "2026-01-01", [_sub("Z1", "Zed", "", "", 3)])
    rep = assemble_student_result_report(STUDENT, [e])
    assert rep["attempts"][0]["subjects"][0]["status"] == "UNKNOWN"
    assert rep["summary"]["subjects_passed"] == 0
