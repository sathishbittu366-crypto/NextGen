// Group 5 — Faculty API client. Mirrors api/routes_faculty.py.
import { apiFetch } from "./client";

export interface FacultyHour {
  faculty_username: string;
  full_name: string;
  total_hours: number;
}

export interface UserAccount {
  id: number;
  username: string;
  full_name: string;
  role: "ADMIN" | "HOD" | "FACULTY" | "STUDENT";
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  must_change_password: boolean;
  student_roll_no: string | null;
}

export interface RolePermission {
  role: "ADMIN" | "HOD" | "FACULTY";
  can_view_student_phone: number;
  can_edit_students: number;
  can_delete_students: number;
  can_view_audit_logs: number;
  can_view_sms_logs: number;
  can_manage_calendar: number;
  can_manage_subjects: number;
}

export interface FacultyPageData {
  hours: FacultyHour[];
  by_subject: Record<string, { faculty_username: string; full_name: string }[]>;
  accounts: UserAccount[];
  permissions?: RolePermission[];
}

export interface CreateAccountBody {
  username: string;
  full_name: string;
  password: string;
  role: "ADMIN" | "HOD" | "FACULTY" | "STUDENT";
  student_roll_no?: string;
}

export async function getFacultyPage(): Promise<FacultyPageData> {
  return apiFetch<FacultyPageData>("/api/faculty", { method: "GET" });
}

export async function createAccount(body: CreateAccountBody): Promise<{ id: number; username: string }> {
  return apiFetch("/api/faculty/create-account", { method: "POST", body });
}

export async function toggleAccountStatus(accountId: number): Promise<{ active: boolean }> {
  return apiFetch(`/api/faculty/accounts/${accountId}/toggle-status`, { method: "POST" });
}

export async function resetStudentPassword(accountId: number): Promise<{ username: string; password: string }> {
  return apiFetch(`/api/faculty/accounts/${accountId}/reset-password`, { method: "POST" });
}

export async function deleteAccount(accountId: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch<{ deleted: boolean; id: number }>(`/api/faculty/accounts/${accountId}`, { method: "DELETE" });
}

export async function getRolePermissions(): Promise<{ permissions: RolePermission[] }> {
  return apiFetch("/api/faculty/permissions", { method: "GET" });
}

export async function saveRolePermissions(body: Partial<RolePermission> & { role: string }): Promise<{ ok: boolean }> {
  return apiFetch("/api/faculty/permissions", { method: "POST", body });
}

export interface UserPermission {
  username: string;
  can_view_students: number;
  can_edit_students: number;
  can_delete_students: number;
  can_manage_attendance: number;
  can_manage_subjects: number;
  can_manage_calendar: number;
  can_view_sms_logs: number;
  can_view_audit_logs: number;
}

export async function getUserPermissions(username: string): Promise<{ username: string; permissions: UserPermission }> {
  return apiFetch(`/api/faculty/accounts/${username}/permissions`, { method: "GET" });
}

export async function saveUserPermissions(username: string, body: Partial<UserPermission>): Promise<{ ok: boolean; permissions: UserPermission }> {
  return apiFetch(`/api/faculty/accounts/${username}/permissions`, { method: "POST", body });
}


export interface SmsDelegatedBatch {
  id: number;
  name: string;
  code: string;
  student_count: number;
}

export interface FacultySmsAccessRow {
  username: string;
  full_name: string;
  active: boolean;
  enabled: boolean;
  allowed_batches: SmsDelegatedBatch[];
}

export interface SmsBatchHandler {
  id: number;
  name: string;
  code: string;
  student_count: number;
  handler_username: string;
  handler_full_name: string;
  is_self: boolean;
}

export interface FacultySmsAccessData {
  faculty: FacultySmsAccessRow[];
  batches: SmsDelegatedBatch[];
  batch_handlers?: SmsBatchHandler[];
}

export async function getSmsAccessControl(): Promise<FacultySmsAccessData> {
  return apiFetch<FacultySmsAccessData>("/api/faculty/sms-access", { method: "GET" });
}

export async function saveSmsAccess(username: string, body: { enabled: boolean; batch_ids: number[] }): Promise<FacultySmsAccessRow> {
  return apiFetch<FacultySmsAccessRow>(`/api/faculty/sms-access/${encodeURIComponent(username)}`, { method: "POST", body });
}

export async function saveSmsBatchHandler(semesterId: number, handlerUsername: string): Promise<{ batch_handlers: SmsBatchHandler[] }> {
  return apiFetch(`/api/faculty/sms-access/batch/${semesterId}`, { method: "POST", body: { handler_username: handlerUsername } });
}
