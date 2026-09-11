"""Notes + Results API."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse, Response

from api.deps import CurrentUser, get_current_user
from api.envelope import ApiError, ok
from database import connect
from webapp.photo_upload import UPLOADS_DIR
from sms_app.services.learning_service import (
    create_note,
    delete_note,
    get_note_for_download,
    get_student_results,
    list_notes,
    result_upload_options,
    save_note_bytes,
    upload_results_excel,
    build_results_template,
)
from sms_app.services.attendance_service import list_subjects

router = APIRouter(tags=["learning"])


@router.get("/api/notes")
async def notes_list(user: CurrentUser = Depends(get_current_user)):
    return ok({"notes": list_notes(username=user.username, role=user.role, student_roll_no=user.student_roll_no)})


@router.get("/api/notes/upload-options")
async def notes_upload_options(user: CurrentUser = Depends(get_current_user)):
    if user.role != "FACULTY":
        raise ApiError("Faculty access only", 403, "FORBIDDEN")
    with connect() as c:
        semesters = c.execute("SELECT id,code,name FROM academic_semesters WHERE active=1 ORDER BY sort_order").fetchall()
    subjects = []
    for sem in semesters:
        for s in list_subjects(sem["id"], user.username, "FACULTY"):
            subjects.append({"id": s["id"], "code": s["code"], "name": s["name"], "semester_id": sem["id"], "semester_code": sem["code"], "semester_name": sem["name"]})
    return ok({"subjects": subjects})


@router.post("/api/notes")
async def notes_upload(
    subject_id: int = Query(...),
    title: str = Query(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    if user.role != "FACULTY":
        raise ApiError("Faculty access only", 403, "FORBIDDEN")
    try:
        with connect() as c:
            subject = c.execute(
                "SELECT s.code FROM subjects s JOIN subject_faculty sf ON sf.subject_id=s.id WHERE s.id=? AND s.active=1 AND sf.faculty_username=?",
                (subject_id, user.username),
            ).fetchone()
        if not subject:
            raise ValueError("You can upload notes only for subjects assigned to you")
        raw = await file.read()
        path, stored_filename = save_note_bytes(
            raw=raw,
            original_filename=file.filename or "",
            subject_code=subject["code"],
        )
        note_id = create_note(
            subject_id=subject_id,
            title=title,
            filename=file.filename or stored_filename,
            file_path=path,
            faculty_username=user.username,
        )
        return ok({"id": note_id, "title": title.strip(), "path": path})
    except ValueError as exc:
        raise ApiError(str(exc), 400, "VALIDATION_ERROR")


@router.delete("/api/notes/{note_id}")
async def notes_delete(note_id: int, user: CurrentUser = Depends(get_current_user)):
    if user.role not in ("FACULTY", "HOD", "ADMIN"):
        raise ApiError("Staff access only", 403, "FORBIDDEN")
    try:
        file_path = delete_note(note_id=note_id, username=user.username, role=user.role)
    except PermissionError as exc:
        raise ApiError(str(exc), 403, "FORBIDDEN")
    if file_path:
        try:
            target = (UPLOADS_DIR / file_path.removeprefix("/files/")).resolve()
            if target.is_file():
                target.unlink()
        except Exception:
            pass
    return ok({"deleted": True})


@router.get("/api/notes/{note_id}/download")
async def notes_download(note_id: int, user: CurrentUser = Depends(get_current_user)):
    row = get_note_for_download(
        note_id=note_id,
        username=user.username,
        role=user.role,
        student_roll_no=user.student_roll_no,
    )
    if not row:
        raise ApiError("Note not found or not authorized", 404, "NOT_FOUND")
    try:
        target = (UPLOADS_DIR / row["file_path"].removeprefix("/files/")).resolve()
    except ValueError:
        raise ApiError("Note not found", 404, "NOT_FOUND")
    allowed_root = (UPLOADS_DIR / "notes").resolve()
    if allowed_root not in target.parents or not target.is_file():
        raise ApiError("Note file not found", 404, "NOT_FOUND")
    return FileResponse(target, filename=row["original_filename"])


@router.get("/api/results/options")
async def results_options(user: CurrentUser = Depends(get_current_user)):
    if user.role != "ADMIN":
        raise ApiError("Admin access only", 403, "FORBIDDEN")
    return ok(result_upload_options())


@router.get("/api/results/template")
async def results_template(user: CurrentUser = Depends(get_current_user)):
    if user.role != "ADMIN":
        raise ApiError("Admin access only", 403, "FORBIDDEN")
    return Response(
        content=build_results_template(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="NextGen-results-template.xlsx"'},
    )


@router.post("/api/results/upload")
async def results_upload(
    branch: str = Query(...),
    batch: str = Query(...),
    semester_id: int = Query(...),
    title: str = Query("Semester Result"),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    if user.role != "ADMIN":
        raise ApiError("Admin access only", 403, "FORBIDDEN")
    try:
        raw = await file.read()
        result = upload_results_excel(
            raw=raw,
            filename=file.filename or "results.xlsx",
            department=branch,
            batch=batch,
            semester_id=semester_id,
            title=title,
            admin_username=user.username,
        )
        return ok(result)
    except ValueError as exc:
        raise ApiError(str(exc), 400, "VALIDATION_ERROR")


@router.get("/api/results/me")
async def results_me(user: CurrentUser = Depends(get_current_user)):
    if user.role != "STUDENT" or not user.student_roll_no:
        raise ApiError("Student access only", 403, "FORBIDDEN")
    return ok(get_student_results(roll_no=user.student_roll_no))
