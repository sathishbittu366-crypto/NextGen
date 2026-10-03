import { apiFetch } from "./client";

export type NotificationCategory = "TIMETABLE" | "CLASS_REMINDER" | "SYSTEM";

export interface AppNotification {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  data: Record<string, unknown>;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationPreferences {
  categories: Record<NotificationCategory, { enabled: boolean; reminder_minutes: number }>;
  push_enabled: boolean;
  push_supported: boolean;
}

export async function getNotifications(limit = 30): Promise<{ notifications: AppNotification[]; unread_count: number }> {
  return apiFetch(`/api/notifications?limit=${encodeURIComponent(limit)}`);
}

export async function getNotificationConfig(): Promise<{ supported: boolean; public_key: string | null }> {
  return apiFetch("/api/notifications/config");
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch("/api/notifications/preferences");
}

export async function updateNotificationPreference(
  category: NotificationCategory,
  patch: { enabled?: boolean; reminder_minutes?: number },
): Promise<{ category: NotificationCategory; enabled: boolean; reminder_minutes: number }> {
  return apiFetch("/api/notifications/preferences", {
    method: "PUT",
    body: { category, ...patch },
  });
}

export async function registerPushSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await apiFetch("/api/notifications/subscriptions", {
    method: "POST",
    body: {
      endpoint: json.endpoint,
      expiration_time: json.expirationTime ? String(json.expirationTime) : null,
      keys: {
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      },
      user_agent: navigator.userAgent,
    },
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await apiFetch("/api/notifications/subscriptions", {
    method: "DELETE",
    body: { endpoint },
  });
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
}

export async function queueTestNotification(): Promise<{ notification_id: number | null }> {
  return apiFetch("/api/notifications/test", { method: "POST" });
}
