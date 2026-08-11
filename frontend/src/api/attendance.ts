// Matches api/routes_attendance.py exactly — one function per route. Keep
// this file in lockstep with that module; if a response shape changes
// there, update the types here in the same change (same rule as auth.ts
// and dashboard.ts).
import { apiFetch, getAuthUrl } from "./client";

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

export type SessionType = "CLASS" | "LAB";

export interface SemesterOption {
  id: number;
  code: string;
  name: string;
}

export interface SubjectOption {
  id: number;
  code: string;
  name: string;
  has_lab: boolean;
}

export interface AttendanceSession {
  id: number;
  attendance_date: string;
  semester_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_code: string;
  semester_name: string;
  faculty_username: string;
  faculty_name: string | null;
  session_type: SessionType;
  duration_hours: number;
  topic: string;
  created_at: string;
}

export interface RosterEntry {
  roll_no: string;
  name: string;
  present: boolean;
}

// ──────────────────────────────────────────────
// Response shapes
// ──────────────────────────────────────────────

export interface SetupData {
  semesters: SemesterOption[];
  subjects: SubjectOption[];
  default_semester_id: number | null;
  today: string;
}

export interface SubjectsData {
  subjects: SubjectOption[];
}

export interface SessionRegisterData {
  session: AttendanceSession;
  editable: boolean;
  roster: RosterEntry[];
  present: number;
  absent: number;
}

// mark-all-present shares the same roster/present/absent shape, plus
// `editable` (no `session` — caller already has it from the initial load).
export interface MarkAllPresentData {
  editable: boolean;
  roster: RosterEntry[];
  present: number;
  absent: number;
}

export interface SaveRegisterData {
  session: AttendanceSession;
  roster: RosterEntry[];
  present: number;
  absent: number;
  sms_queued?: number;
}

export interface OpenSessionBody {
  attendance_date: string;
  semester_id: number;
  subject_id: number;
  session_type: SessionType;
  duration_hours: number;
  topic: string;
}

// ──────────────────────────────────────────────
// API call functions
// ──────────────────────────────────────────────

export async function getSetup(): Promise<SetupData> {
  return apiFetch<SetupData>("/api/attendance/setup");
}

export async function getSubjectsForSemester(semesterId: number): Promise<SubjectsData> {
  return apiFetch<SubjectsData>(`/api/attendance/subjects?semester_id=${semesterId}`);
}

export async function openSession(body: OpenSessionBody): Promise<AttendanceSession> {
  return apiFetch<AttendanceSession>("/api/attendance/sessions", {
    method: "POST",
    body,
  });
}

export async function getSession(sessionId: number): Promise<SessionRegisterData> {
  return apiFetch<SessionRegisterData>(`/api/attendance/sessions/${sessionId}`);
}

export async function markAllPresent(sessionId: number): Promise<MarkAllPresentData> {
  return apiFetch<MarkAllPresentData>(`/api/attendance/sessions/${sessionId}/mark-all-present`, {
    method: "POST",
  });
}

export async function saveRegister(
  sessionId: number,
  presentRollNos: string[]
): Promise<SaveRegisterData> {
  return apiFetch<SaveRegisterData>(`/api/attendance/sessions/${sessionId}/save`, {
    method: "POST",
    body: { present_roll_nos: presentRollNos },
  });
}

export function registerPdfUrl(sessionId: number, kind?: "present" | "absent"): string {
  const qs = kind ? `?kind=${kind}` : "";
  return getAuthUrl(`/api/attendance/sessions/${sessionId}/pdf${qs}`);
}
