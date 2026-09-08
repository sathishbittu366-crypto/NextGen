import { apiFetch, apiUpload, getAuthUrl } from "./client";

export interface NoteItem {
  id: number;
  title: string;
  original_filename: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_id: number;
  semester_code: string;
  semester_name: string;
  faculty_username: string;
  faculty_name: string;
  created_at: string;
  file_path: string;
}

export interface NotesListResponse {
  notes: NoteItem[];
}

export interface NoteUploadSubject {
  id: number;
  code: string;
  name: string;
  semester_id: number;
  semester_code: string;
  semester_name: string;
}

export async function getNotes(): Promise<NotesListResponse> {
  return apiFetch<NotesListResponse>("/api/notes");
}

export async function getNoteUploadOptions(): Promise<{ subjects: NoteUploadSubject[] }> {
  return apiFetch<{ subjects: NoteUploadSubject[] }>("/api/notes/upload-options");
}

export async function uploadNote(subjectId: number, title: string, file: File) {
  const params = new URLSearchParams({ subject_id: String(subjectId), title });
  return apiUpload<{ id: number; title: string; path: string }>(`/api/notes?${params}`, file, "file");
}

export async function deleteNote(noteId: number) {
  return apiFetch<{ deleted: boolean }>(`/api/notes/${noteId}`, { method: "DELETE" });
}

export function getNoteDownloadUrl(noteId: number): string {
  return getAuthUrl(`/api/notes/${noteId}/download`);
}

export interface ResultsOptions {
  branches: { value: string; label: string }[];
  semesters: { id: number; code: string; name: string; active: boolean }[];
}

export async function getResultsOptions(): Promise<ResultsOptions> {
  return apiFetch<ResultsOptions>("/api/results/options");
}

export async function uploadResults(
  branch: string,
  semesterId: number,
  title: string,
  file: File,
) {
  const params = new URLSearchParams({ branch, semester_id: String(semesterId), title });
  return apiUpload<{
    batch_id: number;
    department: string;
    semester_id: number;
    semester_code: string;
    title: string;
    rows_imported: number;
    students_affected: number;
  }>(`/api/results/upload?${params}`, file, "file");
}

export interface StudentResults {
  student: { roll_no: string; name: string; department: string } | null;
  batch: {
    id: number;
    title: string;
    created_at: string;
    source_filename: string | null;
    semester_code: string;
    semester_name: string;
  } | null;
  subjects: {
    subject_code: string;
    subject_name: string;
    marks: number;
    max_marks: number;
    grade: string;
    grade_point: string;
    result_status: string;
    sgpa: string;
    percentage: string;
  }[];
}

export async function getMyResults(): Promise<StudentResults> {
  return apiFetch<StudentResults>("/api/results/me");
}
