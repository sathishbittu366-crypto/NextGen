// HOD Absentee SMS Log & Android Gateway Setup page.
import { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import {
  getSmsLogs, getSmsSettings, saveSmsSettings, testSmsGateway, triggerSmsQueue,
  type SmsLogRow, type SmsSettings
} from "../../api/logs";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function SmsLogPage({ user, onLoggedOut }: Props) {
  const [rows, setRows] = useState<SmsLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Gateway Settings State
  const [settings, setSettings] = useState<SmsSettings>({
    sms_enabled: "1",
    sms_gateway_type: "android",
    sms_android_url: "http://100.92.227.240:8080",
    sms_android_user: "sms",
    sms_android_password: "",
    sms_android_key: "",
    sms_modem_port: "/dev/ttyUSB0",
    sms_modem_baud: "115200",
    sms_daily_cap: "62",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Test Send State
  const [testPhone, setTestPhone] = useState("");
  const [testingSms, setTestingSms] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logData, settingsData] = await Promise.all([
        getSmsLogs().catch(() => []),
        getSmsSettings().catch(() => ({
          sms_enabled: "1",
          sms_gateway_type: "android",
          sms_android_url: "http://100.92.227.240:8080",
          sms_android_user: "sms",
          sms_android_password: "",
          sms_android_key: "",
          sms_modem_port: "/dev/ttyUSB0",
          sms_modem_baud: "115200",
          sms_daily_cap: "62",
        })),
      ]);
      setRows(logData);
      setSettings(settingsData);
    } catch (_err) {
      // Graceful load
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setSuccess(null);
    try {
      await saveSmsSettings(settings);
      setSuccess("SMS Gateway Settings saved successfully!");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save SMS settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      setError("Please enter a test phone number");
      return;
    }
    setTestingSms(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await testSmsGateway(testPhone);
      setSuccess(`Test SMS dispatched successfully! Status: ${res.message}`);
      loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Test SMS failed to dispatch");
    } finally {
      setTestingSms(false);
    }
  };

  const handleTriggerQueue = async () => {
    setDispatching(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await triggerSmsQueue();
      setSuccess(`Queue worker executed. Dispatched: ${res.sent_count || 0}, Failed: ${res.failed_count || 0}`);
      loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to trigger SMS queue worker");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <AppShell user={user} activeNav="sms-log" heading="Absentee SMS Log & Android Gateway" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {success && <ToastPopup type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Gateway Configuration Card */}
      <div className="card" style={{ marginBottom: 28, padding: 24, borderRadius: 16, background: "var(--card-glass)", border: "1px solid var(--border)", boxShadow: "0 20px 45px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #0284c7, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 8px 20px rgba(56, 189, 248, 0.4)" }}>
              📱
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Automatic Absentee SMS & Phone Gateway</h3>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: 13 }}>
                Dispatches instant parent SMS alerts via connected Android phone (SMSGate app) or USB modem.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ background: "linear-gradient(135deg, #0284c7, #2563eb)", color: "#ffffff", fontWeight: 700, padding: "10px 18px", borderRadius: 10, border: "none", boxShadow: "0 8px 20px rgba(56, 189, 248, 0.35)", cursor: "pointer" }}
            onClick={handleTriggerQueue}
            disabled={dispatching}
          >
            {dispatching ? "Sending Pending..." : "⚡ Dispatch Pending SMS Queue"}
          </button>
        </div>

        <form onSubmit={handleSaveSettings}>
          {/* 3D Selector 1: Automatic Absent SMS Status */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 800, fontSize: 13, display: "block", marginBottom: 8, color: "var(--heading-accent)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              1. Automatic Absentee SMS Status
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, sms_enabled: "1" })}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "14px 18px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  border: settings.sms_enabled === "1" ? "2px solid var(--heading-accent)" : "1px solid var(--border)",
                  background: settings.sms_enabled === "1" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(37, 99, 235, 0.4))" : "var(--chip-bg-muted)",
                  color: settings.sms_enabled === "1" ? "var(--text)" : "var(--muted)",
                  boxShadow: settings.sms_enabled === "1" ? "0 8px 20px rgba(56, 189, 248, 0.35)" : "none",
                  transition: "all 0.2s ease",
                  textAlign: "center",
                }}
              >
                ✅ Enabled (Auto Dispatch)
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, sms_enabled: "0" })}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "14px 18px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  border: settings.sms_enabled === "0" ? "2px solid #f43f5e" : "1px solid var(--border)",
                  background: settings.sms_enabled === "0" ? "linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(225, 29, 72, 0.3))" : "var(--chip-bg-muted)",
                  color: settings.sms_enabled === "0" ? "var(--text)" : "var(--muted)",
                  boxShadow: settings.sms_enabled === "0" ? "0 8px 20px rgba(244, 63, 94, 0.3)" : "none",
                  transition: "all 0.2s ease",
                  textAlign: "center",
                }}
              >
                🛑 Disabled
              </button>
            </div>
          </div>

          {/* 3D Selector 2: Gateway Device Type Selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 800, fontSize: 13, display: "block", marginBottom: 8, color: "var(--heading-accent)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              2. Select Gateway Device Mode
            </label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, sms_gateway_type: "android" })}
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "16px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  border: settings.sms_gateway_type === "android" ? "2px solid var(--heading-accent)" : "1px solid var(--border)",
                  background: settings.sms_gateway_type === "android" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(37, 99, 235, 0.45))" : "var(--chip-bg-muted)",
                  color: settings.sms_gateway_type === "android" ? "var(--text)" : "var(--muted)",
                  boxShadow: settings.sms_gateway_type === "android" ? "0 10px 25px rgba(56, 189, 248, 0.4)" : "none",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>📱</span>
                <div>
                  <strong style={{ display: "block", fontSize: 15 }}>Android Phone Gateway</strong>
                  <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>Connects via SMSGate app on phone</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, sms_gateway_type: "modem" })}
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "16px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  border: settings.sms_gateway_type === "modem" ? "2px solid var(--heading-accent)" : "1px solid var(--border)",
                  background: settings.sms_gateway_type === "modem" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(37, 99, 235, 0.45))" : "var(--chip-bg-muted)",
                  color: settings.sms_gateway_type === "modem" ? "var(--text)" : "var(--muted)",
                  boxShadow: settings.sms_gateway_type === "modem" ? "0 10px 25px rgba(56, 189, 248, 0.4)" : "none",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>🔌</span>
                <div>
                  <strong style={{ display: "block", fontSize: 15 }}>USB Serial GSM Modem</strong>
                  <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>Direct AT Commands via USB Dongle</span>
                </div>
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
            {settings.sms_gateway_type === "android" ? (
              <>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>Android Local Address (IP:Port)</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                    placeholder="http://100.92.227.240:8080"
                    value={settings.sms_android_url}
                    onChange={(e) => setSettings({ ...settings, sms_android_url: e.target.value })}
                  />
                  <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                    Copy from "Local address" in SMSGate app screen on phone.
                  </small>
                </div>

                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>App Username</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                    placeholder="sms"
                    value={settings.sms_android_user}
                    onChange={(e) => setSettings({ ...settings, sms_android_user: e.target.value })}
                  />
                  <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                    Shown as Username on SMSGate app screen.
                  </small>
                </div>

                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>App Password</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                    placeholder="Enter password shown on phone screen"
                    value={settings.sms_android_password}
                    onChange={(e) => setSettings({ ...settings, sms_android_password: e.target.value })}
                  />
                  <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                    Shown as Password on SMSGate app screen (e.g. lmkGykF3).
                  </small>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>Modem Serial Port</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                    placeholder="/dev/ttyUSB0 or COM3"
                    value={settings.sms_modem_port}
                    onChange={(e) => setSettings({ ...settings, sms_modem_port: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>Modem Baud Rate</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                    placeholder="115200"
                    value={settings.sms_modem_baud}
                    onChange={(e) => setSettings({ ...settings, sms_modem_baud: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>Daily Maximum SMS Cap</label>
              <input
                type="number"
                className="input-field"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
                value={settings.sms_daily_cap}
                onChange={(e) => setSettings({ ...settings, sms_daily_cap: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: "linear-gradient(135deg, #0284c7, #2563eb)", color: "#ffffff", fontWeight: 700, padding: "12px 24px", borderRadius: 10, border: "none", boxShadow: "0 8px 20px rgba(56, 189, 248, 0.35)", cursor: "pointer" }}
              disabled={savingSettings}
            >
              {savingSettings ? "Saving Gateway Settings..." : "💾 Save Gateway Settings"}
            </button>
          </div>
        </form>

        {/* Test SMS Section */}
        <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid var(--border)" }} />
        <form onSubmit={handleTestSms} style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6, color: "var(--text)" }}>Test Mobile Number</label>
            <input
              type="text"
              className="input-field"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
              placeholder="+919876543210"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ background: "var(--chip-bg-muted)", color: "var(--heading-accent)", fontWeight: 700, padding: "12px 20px", borderRadius: 10, border: "1px solid var(--input-border)", cursor: "pointer" }}
            disabled={testingSms}
          >
            {testingSms ? "Sending Test SMS..." : "📤 Send Test SMS via Phone Gateway"}
          </button>
        </form>
      </div>

      {/* SMS Queue & Logs Table */}
      <div className="table-wrap">
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Absentee SMS Queue & Log History</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Roll No</th>
              <th>Parent Phone</th>
              <th>Message Content</th>
              <th className="center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{r.created_at}</td>
                <td><strong>{r.roll_no}</strong></td>
                <td>{r.parent_phone}</td>
                <td style={{ fontSize: 12 }}>{r.message}</td>
                <td className="center">
                  <span className={`chip ${r.status === "SENT" ? "chip-green" : r.status === "FAILED" ? "chip-red" : "chip-yellow"}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty-note">Loading SMS log…</p>}
        {!loading && rows.length === 0 && <p className="empty-note">No SMS log entries found.</p>}
      </div>
    </AppShell>
  );
}
