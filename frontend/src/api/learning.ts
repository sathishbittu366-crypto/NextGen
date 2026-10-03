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
  batches: string[];
}

export async function getResultsOptions(): Promise<ResultsOptions> {
  return apiFetch<ResultsOptions>("/api/results/options");
}

export async function uploadResults(
  branch: string,
  batch: string,
  semesterId: number,
  title: string,
  file: File,
) {
  const params = new URLSearchParams({ branch, batch, semester_id: String(semesterId), title });
  return apiUpload<{
    batch_id: number;
    department: string;
    semester_id: number;
    semester_code: string;
    title: string;
    rows_imported: number;
    students_affected: number;
    skipped_count: number;
    skipped_students: { row: number; roll_no: string; reason: string }[];
    source_format: "wide" | "long";
    column_mapping: {
      mapped: { header: string; field: string; matched_via: "exact" | "fuzzy" }[];
      ignored: string[];
    };
  }>(`/api/results/upload?${params}`, file, "file");
}


export interface ResultsAdminUpload {
  id: number;
  title: string;
  department: string;
  batch: string | null;
  semester_id: number;
  semester_code: string;
  semester_name: string;
  created_at: string;
  source_filename: string | null;
  students_count: number;
  subject_count: number;
  pass_percentage: number | null;
  passed_students: number;
  failed_students: number;
  unknown_students: number;
}

export interface ResultsAdminDashboard {
  total_uploads: number;
  uploads: ResultsAdminUpload[];
  filter_options: {
    batches: string[];
    semesters: { id: number; code: string; name: string }[];
    titles: string[];
  };
}

export interface ResultsAdminDetail {
  batch: {
    id: number;
    title: string;
    department: string;
    batch: string | null;
    semester_id: number;
    semester_code: string;
    semester_name: string;
    created_at: string;
    source_filename: string | null;
  };
  overview: {
    total_students: number;
    passed_students: number;
    failed_students: number;
    unknown_students: number;
    pass_percentage: number | null;
    total_subject_entries: number;
  };
  subject_analysis: {
    subject_code: string;
    subject_name: string;
    students: number;
    classified_students: number;
    passed: number;
    failed: number;
    pass_percentage: number | null;
  }[];
  grade_distribution: { grade: string; count: number }[];
  top_performers_metric: "SGPA" | "Percentage";
  top_performers: { roll_no: string; name: string; score: number | null }[];
  at_risk_students: { roll_no: string; name: string; failed_subject_count: number }[];
}

export async function getResultsAdminDashboard(): Promise<ResultsAdminDashboard> {
  return apiFetch<ResultsAdminDashboard>("/api/results/admin");
}

export async function getResultsAdminDetail(batchId: number): Promise<ResultsAdminDetail> {
  return apiFetch<ResultsAdminDetail>(`/api/results/admin/${batchId}`);
}

export async function deleteResultsAdminBatch(batchId: number, deleteKey: string): Promise<{ id: number; title: string; deleted: boolean }> {
  return apiFetch<{ id: number; title: string; deleted: boolean }>(`/api/results/admin/${batchId}`, {
    method: "DELETE",
    headers: { "X-Result-Delete-Key": deleteKey },
  });
}


export interface StudentSemesterResult {
  batch: {
    id: number;
    title: string;
    created_at: string;
    source_filename: string | null;
    semester_code: string;
    semester_name: string;
  };
  subjects: {
    subject_code: string;
    subject_name: string;
    marks: number;
    max_marks: number;
    internal_marks: number | null;
    external_marks: number | null;
    credits: number | null;
    grade: string;
    grade_point: string;
    result_status: string;
    sgpa: string;
    percentage: string;
  }[];
  total_credits: number;
  sgpa: string | null;
  result_status: string | null;
}

export interface StudentResults {
  student: { roll_no: string; name: string; department: string } | null;
  results: StudentSemesterResult[];
}
export async function getMyResults(): Promise<StudentResults> {
  return apiFetch<StudentResults>("/api/results/me");
}
