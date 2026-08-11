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
  parent_phone: string;
  message: string;
  status: string;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface SmsSettings {
  sms_enabled: string;
  sms_gateway_type: string;
  sms_android_url: string;
  sms_android_user: string;
  sms_android_password: string;
  sms_android_key: string;
  sms_modem_port: string;
  sms_modem_baud: string;
  sms_daily_cap: string;
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

export async function testSmsGateway(phone: string, message?: string): Promise<{ sent: boolean; message: string }> {
  return apiFetch<{ sent: boolean; message: string }>("/api/dashboard/sms-test", {
    method: "POST",
    body: { phone, message },
  });
}

export async function triggerSmsQueue(): Promise<{ sent_count: number; failed_count: number }> {
  return apiFetch<{ sent_count: number; failed_count: number }>("/api/dashboard/sms-trigger", {
    method: "POST",
  });
}
