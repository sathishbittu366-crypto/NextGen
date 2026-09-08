"""Notes and results business logic for the JSON API."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from database import audit, connect
from webapp.photo_upload import UPLOADS_DIR


NOTES_MAX_BYTES = 15 * 1024 * 1024
NOTES_ALLOWED_EXT = {".pdf", ".ppt", ".pptx", ".doc", ".docx"}
RESULT_ALLOWED_EXT = {".xlsx", ".xlsm"}


def _safe_filename(value: str, fallback: str = "file") -> str:
    base = Path(value or "").stem.strip().lower()
    base = re.sub(r"[^a-z0-9_-]+", "-", base).strip("-_")
    return base or fallback


def save_note_bytes(*, raw: bytes, original_filename: str, subject_code: str) -> tuple[str, str]:
    if not raw:
        raise ValueError("No file was selected")
    if len(raw) > NOTES_MAX_BYTES:
        raise ValueError("Notes file must be smaller than 15MB")
    ext = Path(original_filename or "").suffix.lower()
    if ext not in NOTES_ALLOWED_EXT:
        raise ValueError("Notes must be a PDF, PowerPoint, or Word document")

    target_dir = UPLOADS_DIR / "notes"
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{_safe_filename(subject_code, 'subject')}-{uuid.uuid4().hex[:10]}{ext}"
    (target_dir / filename).write_bytes(raw)
    return f"/files/notes/{filename}", filename


def _note_row(row) -> dict:
    return {
        "id": int(row["id"]),
        "title": row["title"],
        "original_filename": row["original_filename"],
        "subject_id": int(row["subject_id"]),
        "subject_code": row["subject_code"],
        "subject_name": row["subject_name"],
        "semester_id": int(row["semester_id"]),
        "semester_code": row["semester_code"],
        "semester_name": row["semester_name"],
        "faculty_username": row["faculty_username"],
        "faculty_name": row["faculty_name"] or row["faculty_username"],
        "created_at": row["created_at"],
        "file_path": row["file_path"],
    }


def list_notes(*, username: str, role: str, student_roll_no: str | None = None) -> list[dict]:
    with connect() as c:
        if role == "STUDENT":
            student = c.execute(
                "SELECT department, current_semester_id FROM students WHERE roll_no=? AND active=1",
                (student_roll_no,),
            ).fetchone()
            if not student or not student.get("current_semester_id"):
                return []
            rows = c.execute(
                """
                SELECT n.id,n.title,n.original_filename,n.file_path,n.created_at,
                       s.id AS subject_id,s.code AS subject_code,s.name AS subject_name,
                       sem.id AS semester_id,sem.code AS semester_code,sem.name AS semester_name,
                       n.faculty_username,u.full_name AS faculty_name
                FROM notes n
                JOIN subjects s ON s.id=n.subject_id
                JOIN academic_semesters sem ON sem.id=s.semester_id
                JOIN users u ON u.username=n.faculty_username
                JOIN subject_faculty sf ON sf.subject_id=s.id AND sf.faculty_username=n.faculty_username
                WHERE s.active=1 AND sem.active=1 AND sem.id=? AND n.active=1
                ORDER BY s.name, n.created_at DESC, n.id DESC
                """,
                (student["current_semester_id"],),
            ).fetchall()
        elif role == "FACULTY":
            rows = c.execute(
                """
                SELECT n.id,n.title,n.original_filename,n.file_path,n.created_at,
                       s.id AS subject_id,s.code AS subject_code,s.name AS subject_name,
                       sem.id AS semester_id,sem.code AS semester_code,sem.name AS semester_name,
                       n.faculty_username,u.full_name AS faculty_name
                FROM notes n
                JOIN subjects s ON s.id=n.subject_id
                JOIN academic_semesters sem ON sem.id=s.semester_id
                JOIN users u ON u.username=n.faculty_username
                JOIN subject_faculty sf ON sf.subject_id=s.id AND sf.faculty_username=n.faculty_username
                WHERE n.faculty_username=? AND n.active=1
                ORDER BY sem.sort_order, s.name, n.created_at DESC, n.id DESC
                """,
                (username,),
            ).fetchall()
        elif role == "HOD":
            rows = c.execute(
                """
                SELECT n.id,n.title,n.original_filename,n.file_path,n.created_at,
                       s.id AS subject_id,s.code AS subject_code,s.name AS subject_name,
                       sem.id AS semester_id,sem.code AS semester_code,sem.name AS semester_name,
                       n.faculty_username,u.full_name AS faculty_name
                FROM notes n
                JOIN subjects s ON s.id=n.subject_id
                JOIN academic_semesters sem ON sem.id=s.semester_id
                JOIN users u ON u.username=n.faculty_username
                JOIN users fu ON fu.username=n.faculty_username
                WHERE n.active=1 AND (fu.hod_username=? OR fu.username=?)
                ORDER BY sem.sort_order, s.name, n.created_at DESC, n.id DESC
                """,
                (username, username),
            ).fetchall()
        else:  # ADMIN
            rows = c.execute(
                """
                SELECT n.id,n.title,n.original_filename,n.file_path,n.created_at,
                       s.id AS subject_id,s.code AS subject_code,s.name AS subject_name,
                       sem.id AS semester_id,sem.code AS semester_code,sem.name AS semester_name,
                       n.faculty_username,u.full_name AS faculty_name
                FROM notes n
                JOIN subjects s ON s.id=n.subject_id
                JOIN academic_semesters sem ON sem.id=s.semester_id
                JOIN users u ON u.username=n.faculty_username
                WHERE n.active=1
                ORDER BY sem.sort_order, s.name, n.created_at DESC, n.id DESC
                """
            ).fetchall()
    return [_note_row(r) for r in rows]


def get_note_for_download(*, note_id: int, username: str, role: str, student_roll_no: str | None):
    with connect() as c:
        row = c.execute(
            """
            SELECT n.*, s.code AS subject_code, s.name AS subject_name, s.semester_id,
                   sem.code AS semester_code, sem.name AS semester_name,
                   u.full_name AS faculty_name, u.hod_username AS faculty_hod_username
            FROM notes n
            JOIN subjects s ON s.id=n.subject_id
            JOIN academic_semesters sem ON sem.id=s.semester_id
            JOIN users u ON u.username=n.faculty_username
            WHERE n.id=? AND n.active=1
            """,
            (note_id,),
        ).fetchone()
        if not row:
            return None
        if role == "ADMIN":
            return row
        if role == "FACULTY":
            assigned = c.execute(
                "SELECT 1 FROM subject_faculty WHERE subject_id=? AND faculty_username=?",
                (row["subject_id"], username),
            ).fetchone()
            if not assigned:
                return None
            return row
        if role == "HOD":
            if row.get("faculty_hod_username") != username and row.get("faculty_username") != username:
                return None
            return row
        student = c.execute(
            "SELECT current_semester_id FROM students WHERE roll_no=? AND active=1",
            (student_roll_no,),
        ).fetchone()
        if not student or int(student.get("current_semester_id") or 0) != int(row["semester_id"]):
            return None
        # Keep the assignment relationship in the authorization path. A note
        # from an unassigned faculty member must never become student-visible.
        assigned = c.execute(
            "SELECT 1 FROM subject_faculty WHERE subject_id=? AND faculty_username=?",
            (row["subject_id"], row["faculty_username"]),
        ).fetchone()
        return row if assigned else None


def create_note(*, subject_id: int, title: str, filename: str, file_path: str, faculty_username: str) -> int:
    title = (title or "").strip()
    if not title:
        raise ValueError("Note title is required")
    if len(title) > 180:
        raise ValueError("Note title must be 180 characters or fewer")
    with connect() as c:
        row = c.execute(
            """
            SELECT s.id,s.code,s.name,sem.code AS semester_code
            FROM subjects s JOIN academic_semesters sem ON sem.id=s.semester_id
            JOIN subject_faculty sf ON sf.subject_id=s.id
            WHERE s.id=? AND s.active=1 AND sf.faculty_username=?
            """,
            (subject_id, faculty_username),
        ).fetchone()
        if not row:
            raise ValueError("You can upload notes only for subjects assigned to you")
        c.execute(
            """
            INSERT INTO notes(subject_id,faculty_username,title,original_filename,file_path,active)
            VALUES(?,?,?,?,?,1)
            """,
            (subject_id, faculty_username, title, filename, file_path),
        )
        note_id = c.lastrowid
        audit(c, faculty_username, "UPLOAD", "note", f"{row['code']} — {title}")
    return int(note_id)


def delete_note(*, note_id: int, username: str, role: str) -> str | None:
    with connect() as c:
        row = c.execute(
            """
            SELECT n.file_path,n.faculty_username,s.code,u.hod_username
            FROM notes n JOIN subjects s ON s.id=n.subject_id
            JOIN users u ON u.username=n.faculty_username
            WHERE n.id=? AND n.active=1
            """,
            (note_id,),
        ).fetchone()
        if not row:
            return None
        allowed = (
            role == "ADMIN"
            or (role == "FACULTY" and row["faculty_username"] == username)
            or (role == "HOD" and row.get("hod_username") == username)
        )
        if not allowed:
            raise PermissionError("You do not have access to remove this note")
        c.execute("UPDATE notes SET active=0 WHERE id=?", (note_id,))
        audit(c, username, "DELETE_UPLOAD", "note", f"{row['code']} — note {note_id}")
        return row["file_path"]


def result_upload_options() -> dict:
    with connect() as c:
        semesters = c.execute(
            "SELECT id,code,name,active FROM academic_semesters ORDER BY sort_order"
        ).fetchall()
    return {
        "branches": [{"value": d, "label": d} for d in ("CSD",)],
        "semesters": [
            {"id": int(s["id"]), "code": s["code"], "name": s["name"], "active": bool(s["active"])}
            for s in semesters
        ],
    }


def _norm_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


_HEADER_ALIASES = {
    "roll_no": {"roll_no", "roll_number", "roll", "hallticket", "hall_ticket", "student_id"},
    "subject_code": {"subject_code", "code", "subject"},
    "subject_name": {"subject_name", "subject_title", "name"},
    "marks": {"marks", "score", "obtained_marks", "obtained"},
    "max_marks": {"max_marks", "maximum_marks", "max", "out_of"},
    "grade": {"grade", "letter_grade"},
    "grade_point": {"grade_point", "grade_points", "gp"},
    "result_status": {"result", "result_status", "status"},
    "sgpa": {"sgpa", "gpa"},
    "percentage": {"percentage", "percent", "overall_percentage"},
}


def _cell_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _find_columns(headers: list[Any]) -> dict[str, int]:
    normed = [_norm_header(h) for h in headers]
    out: dict[str, int] = {}
    for field, aliases in _HEADER_ALIASES.items():
        for idx, header in enumerate(normed):
            if header in aliases:
                out[field] = idx
                break
    return out


def upload_results_excel(*, raw: bytes, filename: str, department: str, semester_id: int, title: str, admin_username: str) -> dict:
    if not raw:
        raise ValueError("No results file was selected")
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("Results Excel file must be smaller than 10MB")
    if Path(filename or "").suffix.lower() not in RESULT_ALLOWED_EXT:
        raise ValueError("Results must be an .xlsx or .xlsm file")
    department = (department or "").strip().upper()
    title = (title or "").strip() or "Semester Result"
    if department not in {"CSD"}:
        raise ValueError("Select a valid branch")
    if len(title) > 120:
        raise ValueError("Result title must be 120 characters or fewer")

    import io
    try:
        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
    except Exception as exc:
        raise ValueError("The uploaded Excel file could not be read") from exc

    rows = ws.iter_rows(values_only=True)
    try:
        headers = next(rows)
    except StopIteration:
        raise ValueError("The Excel sheet is empty")
    cols = _find_columns(list(headers))
    required = ("roll_no", "subject_code", "subject_name", "marks")
    missing = [f.replace("_", " ") for f in required if f not in cols]
    if missing:
        raise ValueError("Missing required Excel columns: " + ", ".join(missing))

    parsed: list[dict] = []
    seen: set[tuple[str, str]] = set()
    max_source_rows = 5000
    with connect() as c:
        sem = c.execute("SELECT id,code,name FROM academic_semesters WHERE id=?", (semester_id,)).fetchone()
        if not sem:
            raise ValueError("Selected semester does not exist")
        for excel_row_no, row_values in enumerate(rows, start=2):
            if excel_row_no > max_source_rows + 1:
                raise ValueError(f"Results sheet cannot contain more than {max_source_rows} data rows")
            vals = list(row_values)
            roll_no = _cell_str(vals[cols["roll_no"]] if cols["roll_no"] < len(vals) else "")
            subject_code = _cell_str(vals[cols["subject_code"]] if cols["subject_code"] < len(vals) else "").upper()
            subject_name = _cell_str(vals[cols["subject_name"]] if cols["subject_name"] < len(vals) else "")
            if not roll_no and not subject_code and not subject_name:
                continue
            if not roll_no or not subject_code or not subject_name:
                raise ValueError(f"Row {excel_row_no}: roll number, subject code, and subject name are required")
            student = c.execute(
                "SELECT roll_no,name FROM students WHERE roll_no=? AND department=? AND current_semester_id=? AND active=1",
                (roll_no, department, semester_id),
            ).fetchone()
            if not student:
                raise ValueError(f"Row {excel_row_no}: student {roll_no} does not belong to {department} / {sem['code']}")
            key = (roll_no.lower(), subject_code)
            if key in seen:
                raise ValueError(f"Row {excel_row_no}: duplicate subject result for {roll_no} / {subject_code}")
            seen.add(key)

            marks_raw = vals[cols["marks"]] if cols["marks"] < len(vals) else None
            try:
                marks = float(marks_raw)
            except (TypeError, ValueError):
                raise ValueError(f"Row {excel_row_no}: marks must be numeric")
            max_marks = 100.0
            if "max_marks" in cols and cols["max_marks"] < len(vals) and vals[cols["max_marks"]] not in (None, ""):
                try:
                    max_marks = float(vals[cols["max_marks"]])
                except (TypeError, ValueError):
                    raise ValueError(f"Row {excel_row_no}: max marks must be numeric")
            if max_marks <= 0 or marks < 0 or marks > max_marks:
                raise ValueError(f"Row {excel_row_no}: marks must be between 0 and max marks")

            def optional(field: str) -> str:
                return _cell_str(vals[cols[field]]) if field in cols and cols[field] < len(vals) else ""

            parsed.append({
                "roll_no": roll_no,
                "subject_code": subject_code,
                "subject_name": subject_name,
                "marks": marks,
                "max_marks": max_marks,
                "grade": optional("grade"),
                "grade_point": optional("grade_point"),
                "result_status": optional("result_status"),
                "sgpa": optional("sgpa"),
                "percentage": optional("percentage"),
            })

        if not parsed:
            raise ValueError("No valid result rows were found in the Excel file")

        c.execute(
            "INSERT INTO result_batches(department,semester_id,title,uploaded_by,source_filename) VALUES(?,?,?,?,?)",
            (department, semester_id, title, admin_username, filename),
        )
        batch_id = int(c.lastrowid)
        for item in parsed:
            c.execute(
                """
                INSERT INTO result_items(batch_id,roll_no,subject_code,subject_name,marks,max_marks,grade,grade_point,result_status,sgpa,percentage)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    batch_id, item["roll_no"], item["subject_code"], item["subject_name"], item["marks"],
                    item["max_marks"], item["grade"], item["grade_point"], item["result_status"], item["sgpa"], item["percentage"],
                ),
            )
        audit(c, admin_username, "UPLOAD", "results", f"{department} / {sem['code']} — {title} — {len(parsed)} rows")
    wb.close()
    return {
        "batch_id": batch_id,
        "department": department,
        "semester_id": semester_id,
        "semester_code": sem["code"],
        "title": title,
        "rows_imported": len(parsed),
        "students_affected": len({x["roll_no"] for x in parsed}),
    }


def get_student_results(*, roll_no: str) -> dict:
    with connect() as c:
        student = c.execute(
            "SELECT roll_no,name,department,current_semester_id FROM students WHERE roll_no=? AND active=1",
            (roll_no,),
        ).fetchone()
        if not student or not student.get("current_semester_id"):
            return {"student": dict(student) if student else None, "batch": None, "subjects": []}
        batch = c.execute(
            """
            SELECT rb.id,rb.title,rb.created_at,rb.source_filename,sem.code AS semester_code,sem.name AS semester_name
            FROM result_batches rb JOIN academic_semesters sem ON sem.id=rb.semester_id
            WHERE rb.department=? AND rb.semester_id=?
            ORDER BY rb.created_at DESC, rb.id DESC LIMIT 1
            """,
            (student["department"], student["current_semester_id"]),
        ).fetchone()
        if not batch:
            return {"student": dict(student), "batch": None, "subjects": []}
        rows = c.execute(
            """
            SELECT subject_code,subject_name,marks,max_marks,grade,grade_point,result_status,sgpa,percentage
            FROM result_items WHERE batch_id=? ORDER BY subject_name
            """,
            (batch["id"],),
        ).fetchall()
    subjects = [dict(r) for r in rows]
    return {
        "student": {
            "roll_no": student["roll_no"],
            "name": student["name"],
            "department": student["department"],
        },
        "batch": {
            "id": int(batch["id"]),
            "title": batch["title"],
            "created_at": batch["created_at"],
            "source_filename": batch["source_filename"],
            "semester_code": batch["semester_code"],
            "semester_name": batch["semester_name"],
        },
        "subjects": subjects,
    }
