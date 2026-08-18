import { apiFetch } from "./client";

export interface AuditLogRow {
  id: number;
  username: string;
  action: string;
  entity: string;
  details: string | null;
  created_at: string;
}

export interface SmsLogRow {
  id: number;
  roll_no: string;
  student_name?: string;
  parent_phone: string;
  message: string;
  status: string;
  approved?: number;
  hod_username?: string | null;
  gateway_id?: number | null;
  gateway_name?: string | null;
  gateway_mode?: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface SmsSettings {
  sms_enabled: string;
  sms_daily_cap: string;
}

export interface SmsGateway {
  id: number;
  hod_username: string;
  gateway_name: string;
  gateway_mode: "cloud" | "local" | "modem" | string;
  device_id: string;
  local_url: string;
  username: string;
  password_set: boolean;
  modem_port: string;
  modem_baud: string;
  sim_number: number | null;
  active: boolean;
  updated_at: string | null;
}

export interface SmsApprovalRow {
  id: number;
  roll_no: string;
  student_name: string;
  parent_phone: string;
  message: string;
  send_date: string;
  hod_username: string | null;
  gateway_id: number | null;
  gateway_name: string | null;
  gateway_mode: string | null;
  gateway_active: boolean;
  error: string | null;
}

export async function getAuditLogs(): Promise<AuditLogRow[]> {
  return apiFetch<AuditLogRow[]>("/api/dashboard/audit-log", { method: "GET" });
}

export async function getSmsLogs(): Promise<SmsLogRow[]> {
  return apiFetch<SmsLogRow[]>("/api/dashboard/sms-log", { method: "GET" });
}

export async function getSmsSettings(): Promise<SmsSettings> {
  return apiFetch<SmsSettings>("/api/dashboard/sms-settings", { method: "GET" });
}

export async function saveSmsSettings(settings: SmsSettings): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/dashboard/sms-settings", {
    method: "POST",
    body: settings,
  });
}

export async function getSmsGateways(): Promise<SmsGateway[]> {
  return apiFetch<SmsGateway[]>("/api/dashboard/sms-gateways", { method: "GET" });
}

export async function createSmsGateway(body: Partial<SmsGateway> & { password?: string }): Promise<SmsGateway> {
  return apiFetch<SmsGateway>("/api/dashboard/sms-gateways", { method: "POST", body });
}

export async function updateSmsGateway(id: number, body: Partial<SmsGateway> & { password?: string }): Promise<SmsGateway> {
  return apiFetch<SmsGateway>(`/api/dashboard/sms-gateways/${id}`, { method: "PATCH", body });
}

export async function testSmsGatewayConnection(id: number): Promise<{ ok: boolean; mode: string; device?: unknown; health?: string; message?: string }> {
  return apiFetch<{ ok: boolean; mode: string; device?: unknown; health?: string; message?: string }>(`/api/dashboard/sms-gateways/${id}/test-connection`, { method: "POST" });
}

export async function getSmsApproval(sendDate?: string): Promise<SmsApprovalRow[]> {
  const query = sendDate ? `?send_date=${encodeURIComponent(sendDate)}` : "";
  return apiFetch<SmsApprovalRow[]>(`/api/dashboard/sms-approval${query}`, { method: "GET" });
}

export async function approveSmsBatch(sendDate: string): Promise<{ approved_count: number; send_date: string; hod_username?: string }> {
  return apiFetch<{ approved_count: number; send_date: string; hod_username?: string }>(`/api/dashboard/sms-approval`, {
    method: "POST",
    body: { send_date: sendDate },
  });
}

export async function testSmsGateway(phone: string, gatewayId: number, message?: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/api/dashboard/sms-test", {
    method: "POST",
    body: { phone, gateway_id: gatewayId, message },
  });
}

export async function triggerSmsQueue(): Promise<{ sent_count: number; failed_count: number }> {
  return apiFetch<{ sent_count: number; failed_count: number }>("/api/dashboard/sms-trigger", {
    method: "POST",
  });
}
