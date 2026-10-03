import { useEffect, useMemo, useRef, useState } from "react";
import {
  getNotificationPreferences,
  getNotifications,
  queueTestNotification,
  markNotificationRead,
  updateNotificationPreference,
  type AppNotification,
  type NotificationCategory,
  type NotificationPreferences,
} from "../api/notifications";
import { disableWebPush, enableWebPush, getExistingPushSubscription, webPushSupported } from "../notifications/webPush";
import { ApiClientError } from "../api/client";

function timeAgo(value: string | null): string {
  if (!value) return "";
  const raw = value.includes("T") ? value : value.replace(" ", "T");
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}+05:30`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const labels: Record<NotificationCategory, string> = {
  TIMETABLE: "Timetable updates",
  CLASS_REMINDER: "Class reminders",
  SYSTEM: "Important updates",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pushActive, setPushActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    try {
      const [items, prefs] = await Promise.all([getNotifications(30), getNotificationPreferences()]);
      setNotifications(items.notifications);
      setUnread(items.unread_count);
      setPreferences(prefs);
      const subscription = await getExistingPushSubscription();
      setPushActive(Boolean(prefs.push_enabled && subscription));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load notifications");
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const orderedCategories = useMemo(() => (["TIMETABLE", "CLASS_REMINDER", "SYSTEM"] as NotificationCategory[]), []);

  async function toggleCategory(category: NotificationCategory, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await updateNotificationPreference(category, { enabled });
      setPreferences((current) => current ? {
        ...current,
        categories: {
          ...current.categories,
          [category]: { ...current.categories[category], enabled: result.enabled },
        },
      } : current);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update notification preference");
    } finally { setBusy(false); }
  }

  async function changeLead(minutes: number) {
    setBusy(true);
    setError(null);
    try {
      const result = await updateNotificationPreference("CLASS_REMINDER", { reminder_minutes: minutes });
      setPreferences((current) => current ? {
        ...current,
        categories: {
          ...current.categories,
          CLASS_REMINDER: { ...current.categories.CLASS_REMINDER, reminder_minutes: result.reminder_minutes },
        },
      } : current);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update reminder timing");
    } finally { setBusy(false); }
  }

  async function togglePush() {
    setBusy(true);
    setError(null);
    try {
      if (pushActive) {
        await disableWebPush();
        setPushActive(false);
      } else {
        await enableWebPush();
        setPushActive(true);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change push notifications");
    } finally { setBusy(false); }
  }

  async function openNotification(item: AppNotification) {
    if (!item.read_at) {
      await markNotificationRead(item.id).catch(() => undefined);
      setNotifications((items) => items.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnread((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (item.url) window.location.assign(item.url);
  }

  const pushAvailable = webPushSupported() && Boolean(preferences?.push_supported);

  return (
    <div className="ng-notification-root" ref={rootRef}>
      <button
        type="button"
        className="ng-notification-trigger"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); setError(null); if (!open) void refresh(); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unread > 0 && <span className="ng-notification-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <section className="ng-notification-panel" role="dialog" aria-label="Notifications">
          <header className="ng-notification-head">
            <div>
              <span className="ng-section-kicker">Updates</span>
              <h2>Notifications</h2>
            </div>
            <button type="button" className="ng-close" onClick={() => setOpen(false)} aria-label="Close notifications">×</button>
          </header>

          <div className="ng-notification-push-row">
            <div>
              <strong>Browser notifications</strong>
              <span>{pushAvailable
                ? (pushActive ? "Enabled on this browser. You can disable it anytime." : "Receive timetable and class reminders even when this app is closed.")
                : "Web push needs HTTPS and VAPID setup on the deployment."}</span>
            </div>
            <div className="ng-notification-push-actions">
              <button
                type="button"
                className={`ng-notification-action ${pushActive ? "active" : ""}`}
                disabled={busy || !pushAvailable}
                onClick={() => void togglePush()}
              >
                {pushActive ? "Disable" : "Enable"}
              </button>
              {pushActive && (
                <button
                  type="button"
                  className="ng-notification-test"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try { await queueTestNotification(); }
                    catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not queue test notification"); }
                    finally { setBusy(false); }
                  }}
                >Test</button>
              )}
            </div>
          </div>

          <div className="ng-notification-preferences">
            {preferences && orderedCategories.map((category) => {
              const pref = preferences.categories[category];
              return (
                <div className="ng-notification-pref" key={category}>
                  <span>{labels[category]}</span>
                  <input type="checkbox" checked={Boolean(pref?.enabled)} disabled={busy} onChange={(event) => void toggleCategory(category, event.target.checked)} />
                </div>
              );
            })}
            {preferences?.categories.CLASS_REMINDER?.enabled && (
              <label className="ng-notification-lead">
                Remind me
                <select value={preferences.categories.CLASS_REMINDER.reminder_minutes} disabled={busy} onChange={(event) => void changeLead(Number(event.target.value))}>
                  {[5, 10, 15, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} min before</option>)}
                </select>
              </label>
            )}
          </div>

          {error && <div className="ng-notification-error" role="status">{error}</div>}

          <div className="ng-notification-list">
            {notifications.length === 0 ? (
              <div className="ng-notification-empty">No notifications yet.</div>
            ) : notifications.map((item) => (
              <button type="button" className={`ng-notification-item${item.read_at ? "" : " unread"}`} key={item.id} onClick={() => void openNotification(item)}>
                <span className="ng-notification-item-dot" aria-hidden="true" />
                <span className="ng-notification-item-copy">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small>{timeAgo(item.created_at)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
