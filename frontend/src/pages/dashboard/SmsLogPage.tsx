import { Fragment, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import {
  createSmsGateway,
  getSmsApproval,
  getSmsGateways,
  getSmsLogs,
  getSmsActivity,
  getSmsSettings,
  saveSmsSettings,
  testSmsGateway,
  testSmsGatewayConnection,
  updateSmsGateway,
  setSmsGatewayAutoSend,
  approveSmsRow,
  rejectSmsRow,
  approveSmsBatch,
  getSmsBatches,
  getSmsTemplates,
  saveSmsTemplate,
  sendGeneralNotice,
  type SmsRecipient,
  getMySmsAccess,
  type SmsApprovalRow,
  type SmsGateway,
  type SmsLogRow,
  type SmsActivityRow,
  type SmsSettings,
  type SmsBatch,
  type SmsAccessMe,
} from "../../api/logs";
import { ApiClientError } from "../../api/client";
import { getFacultyPage, getSmsAccessControl, type UserAccount, type FacultySmsAccessData } from "../../api/faculty";
import { AdminStudentSelfEditCard } from "../../components/AdminStudentSelfEditCard";
import { EmptyState, Icon, Modal, Pill, Switch, TabPanel, Tabs, humanize, useConfirm, type TabDef, type Tone } from "../../components/ngx";

interface Props {
  user: { username: string; role: string };
  onLoggedOut: () => void;
}

type GatewayForm = {
  gateway_name: string;
  gateway_mode: "cloud" | "local" | "modem";
  device_id: string;
  local_url: string;
  username: string;
  password: string;
  modem_port: string;
  modem_baud: string;
  sim_number: string;
  active: boolean;
  hod_username?: string;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const blankGateway: GatewayForm = {
  gateway_name: "SMSGate Phone",
  gateway_mode: "cloud",
  device_id: "",
  local_url: "",
  username: "",
  password: "",
  modem_port: "",
  modem_baud: "115200",
  sim_number: "",
  active: true,
  hod_username: "",
};

function formFromGateway(g: SmsGateway): GatewayForm {
  return {
    gateway_name: g.gateway_name,
    gateway_mode: g.gateway_mode === "local" || g.gateway_mode === "modem" ? g.gateway_mode : "cloud",
    device_id: g.device_id || "",
    local_url: g.local_url || "",
    username: g.username || "",
    password: "",
    modem_port: g.modem_port || "",
    modem_baud: g.modem_baud || "115200",
    sim_number: g.sim_number ? String(g.sim_number) : "",
    active: g.active,
    hod_username: g.hod_username,
  };
}

export function SmsLogPage({ user, onLoggedOut }: Props) {
  const isAdmin = user.role === "ADMIN";
  const isHod = user.role === "HOD";
  const isFaculty = user.role === "FACULTY";

  const [settings, setSettings] = useState<SmsSettings>({ sms_enabled: "1", sms_daily_cap: "1000", sms_absentee_cutoff_time: "10:15" });
  const [messageType, setMessageType] = useState<"ABSENTEE_ALERT" | "GENERAL_NOTICE">("ABSENTEE_ALERT");
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [composeText, setComposeText] = useState("");
  const [recipient, setRecipient] = useState<SmsRecipient>("PARENT");
  const [batches, setBatches] = useState<SmsBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [gateways, setGateways] = useState<SmsGateway[]>([]);
  const [gateway, setGateway] = useState<GatewayForm>(blankGateway);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);
  const [hodAccounts, setHodAccounts] = useState<UserAccount[]>([]);
  const [selectedHodUsername, setSelectedHodUsername] = useState("");
  const [approvalDate, setApprovalDate] = useState(today());
  const [approvalRows, setApprovalRows] = useState<SmsApprovalRow[]>([]);
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [smsActivity, setSmsActivity] = useState<SmsActivityRow[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [facultyAccess, setFacultyAccess] = useState<SmsAccessMe | null>(null);
  const [hodSmsAccess, setHodSmsAccess] = useState<FacultySmsAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [testingGatewayId, setTestingGatewayId] = useState<number | null>(null);
  const [gatewayConnectionStatus, setGatewayConnectionStatus] = useState<Record<number, "connected" | "not_connected">>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requestedTab, setRequestedTab] = useState("");
  const { confirm, dialog } = useConfirm();

  const currentGateway = useMemo(() => {
    if (isAdmin) return gateways.find((g) => g.hod_username === selectedHodUsername) || null;
    if (isFaculty) return gateways.find((g) => g.owner_username === user.username) || null;
    return gateways.find((g) => g.owner_username === user.username && g.hod_username === user.username) || gateways[0] || null;
  }, [gateways, selectedGatewayId, selectedHodUsername, isAdmin, isFaculty, user.username]);

  const gatewayConfigured = Boolean(currentGateway && (
    (currentGateway.gateway_mode === "cloud" && currentGateway.device_id_configured && currentGateway.username && currentGateway.password_set) ||
    (currentGateway.gateway_mode === "local" && currentGateway.local_url) ||
    (currentGateway.gateway_mode === "modem" && currentGateway.modem_port)
  ));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const [gatewayData, activityData] = await Promise.all([getSmsGateways(), getSmsActivity()]);
        setGateways(gatewayData);
        setSmsActivity(activityData);
        setLogs([]);
        setBatches([]);
        return;
      }
      if (isFaculty) {
        const access = await getMySmsAccess();
        setFacultyAccess(access);
        if (!access.enabled) {
          setGateways([]);
          setBatches([]);
          setLogs([]);
          return;
        }
        const [gatewayData, logData, activityData, batchData, templateData] = await Promise.all([
          getSmsGateways(), getSmsLogs(), getSmsActivity(), getSmsBatches(), getSmsTemplates(),
        ]);
        setGateways(gatewayData);
        setLogs(logData);
        setSmsActivity(activityData);
        setBatches(batchData);
        setTemplates(templateData);
        setComposeText(templateData.GENERAL_NOTICE || "Dear Parent, {student}: {message} - VCET CSD Dept");
        const chosen = gatewayData.find((g) => g.owner_username === user.username) || gatewayData[0];
        if (chosen) {
          setSelectedGatewayId(chosen.id);
          setGateway(formFromGateway(chosen));
        } else {
          setSelectedGatewayId(null);
          setGateway({ ...blankGateway, hod_username: access.hod_username || "" });
        }
        if (selectedBatchId === null && batchData.length) setSelectedBatchId(batchData[0].id);
        return;
      }

      const [settingsData, gatewayData, logData, activityData, approvalData, templateData, batchData, facultyData, accessData] = await Promise.all([
        getSmsSettings(), getSmsGateways(), getSmsLogs(), getSmsActivity(), getSmsApproval(approvalDate), getSmsTemplates(), getSmsBatches(),
        isAdmin ? getFacultyPage() : Promise.resolve(null),
        isHod ? getSmsAccessControl() : Promise.resolve(null),
      ]);
      setSettings(settingsData);
      setGateways(gatewayData);
      setLogs(logData);
      setSmsActivity(activityData);
      setApprovalRows(approvalData);
      setTemplates(templateData);
      setComposeText(templateData[messageType] || "");
      setBatches(batchData);
      setHodSmsAccess(accessData);
      if (selectedBatchId === null && batchData.length) setSelectedBatchId(batchData[0].id);
      const facultyHods = facultyData ? facultyData.accounts.filter((a) => a.role === "HOD" && a.active) : [];
      // Keep the Admin HOD selector usable even when the Faculty roster is
      // temporarily unavailable: the gateway response itself carries the
      // authoritative HOD scope for already-configured gateways.
      const fallbackHods = gatewayData
        .map((g) => g.hod_username)
        .filter((u, i, all) => Boolean(u) && all.indexOf(u) === i)
        .map((username) => ({ username, full_name: username, role: "HOD", active: true } as UserAccount));
      setHodAccounts(facultyHods.length ? facultyHods : fallbackHods);
      if (gatewayData.length) {
        const chosen = isAdmin
          ? (gatewayData.find((g) => g.hod_username === selectedHodUsername && g.owner_username === selectedHodUsername) || gatewayData.find((g) => g.hod_username === selectedHodUsername) || gatewayData[0])
          : (gatewayData.find((g) => g.hod_username === user.username && g.owner_username === user.username) || gatewayData.find((g) => g.id === selectedGatewayId) || gatewayData[0]);
        setSelectedGatewayId(chosen.id);
        setGateway(formFromGateway(chosen));
        if (isAdmin) setSelectedHodUsername(chosen.hod_username || "");
      } else {
        setSelectedGatewayId(null);
        setGateway({ ...blankGateway, hod_username: isAdmin ? selectedHodUsername : user.username });
      }
    } catch (err) {
      if (isFaculty && err instanceof ApiClientError && err.status === 403) {
        setFacultyAccess({ enabled: false, hod_username: null, allowed_batches: [], gateway_configured: false });
        setError(err.message);
      } else {
        setError(err instanceof ApiClientError ? err.message : "Could not load SMS configuration");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [approvalDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveGateway = async () => {
    setBusy("gateway"); setError(null);
    try {
      const payload = {
        ...gateway,
        ...(isAdmin && !currentGateway ? { hod_username: selectedHodUsername } : {}),
        sim_number: gateway.sim_number ? Number(gateway.sim_number) : null,
      };
      if (isAdmin && !currentGateway && !selectedHodUsername) {
        setError("Select the responsible HOD before creating a gateway."); setBusy(null); return;
      }
      const saved = currentGateway ? await updateSmsGateway(currentGateway.id, payload) : await createSmsGateway(payload);
      setGateways((old) => [...old.filter((g) => g.id !== saved.id), saved]);
      setSelectedGatewayId(saved.id); setGateway(formFromGateway(saved));
      setSuccess("SMS gateway configuration saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save gateway");
    } finally { setBusy(null); }
  };

  const testConnection = async (gatewayId = currentGateway?.id) => {
    if (!gatewayId) return;
    setBusy("connection");
    setTestingGatewayId(gatewayId);
    setError(null);
    setGatewayConnectionStatus((old) => {
      const next = { ...old };
      delete next[gatewayId];
      return next;
    });
    try {
      const result = await testSmsGatewayConnection(gatewayId);
      setGatewayConnectionStatus((old) => ({ ...old, [gatewayId]: result.ok ? "connected" : "not_connected" }));
      setSuccess(result.mode === "cloud" ? "Cloud credentials and device ID are valid." : "Gateway connection check passed.");
    } catch (err) {
      setGatewayConnectionStatus((old) => ({ ...old, [gatewayId]: "not_connected" }));
      setError(err instanceof ApiClientError ? err.message : "Gateway connection test failed");
    } finally {
      setBusy(null);
      setTestingGatewayId(null);
    }
  };

  const sendTest = async () => {
    if (!currentGateway) { setError("Configure an SMS gateway first."); return; }
    if (!testPhone.trim()) { setError("Enter a test phone number."); return; }
    setBusy("test-sms"); setError(null);
    try {
      await testSmsGateway(testPhone.trim(), currentGateway.id);
      setSuccess("Test SMS accepted by the configured gateway."); setTestPhone(""); setLogs(await getSmsLogs());
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Test SMS failed"); }
    finally { setBusy(null); }
  };

  // The saved wording is parent-facing, so flipping the audience flips a leading
  // salutation too. Anything the sender has rewritten is left exactly as typed.
  const chooseRecipient = (next: SmsRecipient) => {
    if (next === recipient) return;
    setRecipient(next);
    setComposeText((t) => next === "STUDENT"
      ? t.replace(/^Dear Parents?\b/i, "Dear Student")
      : t.replace(/^Dear Students?\b/i, "Dear Parent"));
  };

  const sendGeneral = async () => {
    if (!selectedBatchId || !composeText.trim()) return;
    const batch = batches.find((b) => b.id === selectedBatchId);
    const label = batch ? (batch.code || batch.name) : "the selected batch";
    const toStudents = recipient === "STUDENT";
    const who = toStudents ? "student" : "parent";
    const ok = await confirm({
      title: isFaculty ? `Send SMS to ${label} ${who}s?` : `Queue notice for ${label} ${who}s?`,
      body: (
        <>
          <p>{batch ? `Every ${who} in ${label} (${batch.student_count} students) will receive this message${toStudents ? " on their own phone" : ""}${isFaculty ? " right away" : " once it is approved"}.` : `Every ${who} in the selected batch will receive this message.`}</p>
          <div className="ngx-quote">{composeText}</div>
        </>
      ),
      confirmLabel: isFaculty ? "Send SMS" : "Queue notice",
    });
    if (!ok) return;
    setBusy("general"); setError(null);
    try {
      const result = await sendGeneralNotice(selectedBatchId, composeText, recipient);
      const noPhone = result.blocked_count ? ` ${result.blocked_count} blocked: no ${who} phone on file.` : "";
      setSuccess(`${result.queued_count} message(s) queued.${noPhone}`);
      await load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not queue SMS"); }
    finally { setBusy(null); }
  };

  const approve = async () => {
    if (!approvalRows.length) return;
    const ok = await confirm({
      title: `Approve ${approvalRows.length} message${approvalRows.length === 1 ? "" : "s"}?`,
      body: <p>Absentee messages for {prettyDate(approvalDate)} will be released for sending.</p>,
      confirmLabel: `Approve ${approvalRows.length}`,
    });
    if (!ok) return;
    setBusy("approve"); setError(null);
    try { const result = await approveSmsBatch(approvalDate); setSuccess(`${result.approved_count} message(s) approved.`); await load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not approve SMS batch"); }
    finally { setBusy(null); }
  };

  const approveOne = async (r: SmsApprovalRow) => {
    const ok = await confirm({
      title: `Approve SMS for ${r.student_name}?`,
      body: <><div className="ngx-quote">{r.message}</div><p className="ngx-hint">To {r.recipient_type === "STUDENT" ? "student " : ""}{r.parent_phone}</p></>,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setBusy(`approve-${r.id}`);
    try { await approveSmsRow(r.id); setSuccess(`SMS approved for ${r.roll_no}.`); await load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not approve SMS"); }
    finally { setBusy(null); }
  };

  const rejectOne = async (r: SmsApprovalRow) => {
    const ok = await confirm({
      title: `Reject SMS for ${r.student_name}?`,
      body: <p>This message will not be sent to {r.recipient_type === "STUDENT" ? "the student at " : ""}{r.parent_phone}.</p>,
      confirmLabel: "Reject message",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(`reject-${r.id}`);
    try { await rejectSmsRow(r.id); setSuccess(`SMS rejected for ${r.roll_no}.`); await load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not reject SMS"); }
    finally { setBusy(null); }
  };

  const saveOperationsSettings = async () => {
    setBusy("settings"); setError(null);
    try { await saveSmsSettings(settings); setSuccess("SMS sending settings saved."); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not save SMS settings"); }
    finally { setBusy(null); }
  };

  const saveTemplate = async () => {
    try {
      const r = await saveSmsTemplate(messageType, composeText);
      setTemplates((t) => ({ ...t, [messageType]: r.template }));
      setSuccess("Message template saved for this scope.");
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not save message template"); }
  };

  const toggleAutoSend = async (next: boolean) => {
    if (!currentGateway) return;
    try {
      const res = await setSmsGatewayAutoSend(currentGateway.id, next);
      setGateways((old) => old.map((g) => (g.id === currentGateway.id ? { ...g, auto_send: res.auto_send } : g)));
      setSuccess(res.auto_send ? "Auto-send enabled for your gateway." : "Auto-send disabled.");
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not change auto-send setting"); }
  };

  const tabIds = isFaculty ? ["compose", "activity", "setup"] : ["review", "compose", "activity", "setup"];
  const tab = tabIds.includes(requestedTab) ? requestedTab : tabIds[0];
  const setTab = (id: string) => setRequestedTab(id);

  if (isAdmin) {
    return <AdminGatewayOverview user={user} onLoggedOut={onLoggedOut} gateways={gateways} activities={smsActivity} loading={loading} error={error} onRefresh={() => void load()} onClearError={() => setError(null)} />;
  }

  if (isFaculty && !loading && facultyAccess && !facultyAccess.enabled) {
    return (
      <AppShell user={user as any} activeNav="sms-log" heading="SMS Gateway" onLoggedOut={onLoggedOut}>
        <ErrorPopup message={error} onClose={() => setError(null)} />
        <div className="ngx ngx-page">
          <div className="ngx-card">
            <EmptyState title="SMS Gateway access is not enabled" hint="Your HOD has not delegated SMS sending to this account yet. Ask them to enable it from the Faculty page." />
          </div>
        </div>
      </AppShell>
    );
  }

  const gatewayState: { tone: "good" | "bad" | "warn"; label: string } = !currentGateway
    ? { tone: "bad", label: "Not configured" }
    : !currentGateway.active
      ? { tone: "warn", label: "Disabled" }
      : gatewayConfigured
        ? { tone: "good", label: "Ready" }
        : { tone: "bad", label: "Not configured" };
  const connection = currentGateway ? gatewayConnectionStatus[currentGateway.id] : undefined;
  const blockedCount = approvalRows.filter((r) => r.error).length;
  const handlers = (hodSmsAccess?.faculty || []).filter((f) => f.enabled);
  const handlerReady = (f: (typeof handlers)[number]) => {
    const g = gateways.find((x) => x.owner_username === f.username && x.hod_username === user.username);
    return Boolean(g && g.active && ((g.gateway_mode === "cloud" && g.device_id_configured && g.username && g.password_set) || (g.gateway_mode === "local" && g.local_url) || (g.gateway_mode === "modem" && g.modem_port)));
  };
  const setupNeedsAttention = gatewayState.tone !== "good" || (isHod && handlers.some((f) => !handlerReady(f)));
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const tabs: TabDef[] = isFaculty
    ? [
        { id: "compose", label: "Send message" },
        { id: "activity", label: "Activity", count: smsActivity.length },
        { id: "setup", label: "Gateway", alert: setupNeedsAttention },
      ]
    : [
        { id: "review", label: "Review", count: approvalRows.length || null },
        { id: "compose", label: "Compose" },
        { id: "activity", label: "Activity", count: smsActivity.length },
        { id: "setup", label: "Setup", alert: setupNeedsAttention },
      ];

  const gatewayForm = (
    <>
      {isFaculty && facultyAccess && (
        <div className="ngx-assigned">
          <span className="ngx-label">Delegated by</span>
          <strong>{facultyAccess.hod_username || "Your HOD"}</strong>
          <div className="ngx-chips">
            {facultyAccess.allowed_batches.map((b) => <span key={b.id} className="ngx-chip">{b.code || b.name} · {b.student_count}</span>)}
            {!facultyAccess.allowed_batches.length && <span className="ngx-chip is-none">No batch delegated</span>}
          </div>
        </div>
      )}
      {isFaculty && !currentGateway && (
        <div className="ngx-notice is-info" style={{ marginBottom: 18 }}>
          <Icon name="info" />
          <span>No gateway yet. Add your own credentials below; other Faculty credentials are never visible to you.</span>
        </div>
      )}
      <div className="ngx-form-grid">
        <label className="ngx-field"><span>Gateway name</span><input className="ngx-input" value={gateway.gateway_name} onChange={(e) => setGateway({ ...gateway, gateway_name: e.target.value })} /></label>
        <label className="ngx-field"><span>Mode</span>
          <select className="ngx-select" value={gateway.gateway_mode} onChange={(e) => setGateway({ ...gateway, gateway_mode: e.target.value as GatewayForm["gateway_mode"] })}>
            <option value="cloud">Cloud server</option><option value="local">Local server</option><option value="modem">USB / serial modem</option>
          </select>
        </label>
        {gateway.gateway_mode === "cloud" && <>
          <label className="ngx-field"><span>Device ID</span><input className="ngx-input" value={gateway.device_id} onChange={(e) => setGateway({ ...gateway, device_id: e.target.value })} placeholder={currentGateway?.device_id_masked || "Enter device ID"} autoComplete="off" /></label>
          <label className="ngx-field"><span>Cloud username</span><input className="ngx-input" value={gateway.username} onChange={(e) => setGateway({ ...gateway, username: e.target.value })} autoComplete="off" /></label>
          <label className="ngx-field"><span>Cloud password {currentGateway?.password_set && <em>· leave blank to keep</em>}</span><input type="password" className="ngx-input" value={gateway.password} onChange={(e) => setGateway({ ...gateway, password: e.target.value })} autoComplete="new-password" /></label>
          <label className="ngx-field"><span>SIM slot <em>· optional</em></span><input type="number" min={1} max={3} className="ngx-input" value={gateway.sim_number} onChange={(e) => setGateway({ ...gateway, sim_number: e.target.value })} /></label>
        </>}
        {gateway.gateway_mode === "local" && <>
          <label className="ngx-field is-wide"><span>Local server URL</span><input className="ngx-input" value={gateway.local_url} onChange={(e) => setGateway({ ...gateway, local_url: e.target.value })} placeholder="http://phone-ip:8080" /></label>
          <label className="ngx-field"><span>Username</span><input className="ngx-input" value={gateway.username} onChange={(e) => setGateway({ ...gateway, username: e.target.value })} autoComplete="off" /></label>
          <label className="ngx-field"><span>Password {currentGateway?.password_set && <em>· leave blank to keep</em>}</span><input type="password" className="ngx-input" value={gateway.password} onChange={(e) => setGateway({ ...gateway, password: e.target.value })} autoComplete="new-password" /></label>
        </>}
        {gateway.gateway_mode === "modem" && <>
          <label className="ngx-field"><span>Serial port</span><input className="ngx-input" value={gateway.modem_port} onChange={(e) => setGateway({ ...gateway, modem_port: e.target.value })} placeholder="COM3 or /dev/ttyUSB0" /></label>
          <label className="ngx-field"><span>Baud rate</span><input className="ngx-input" value={gateway.modem_baud} onChange={(e) => setGateway({ ...gateway, modem_baud: e.target.value })} /></label>
        </>}
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="ngx-toggle-row">
          <div><strong>Gateway enabled</strong></div>
          <Switch label="Gateway enabled" checked={gateway.active} onChange={(v) => setGateway({ ...gateway, active: v })} />
        </div>
        {currentGateway && (
          <div className="ngx-toggle-row">
            <div><strong>Auto-send approved SMS</strong><small>Send queued messages without manual review. Applies immediately.</small></div>
            <Switch label="Auto-send approved SMS" checked={Boolean(currentGateway.auto_send)} onChange={(v) => void toggleAutoSend(v)} />
          </div>
        )}
      </div>
      <div className="ngx-form-actions">
        <button className="ngx-btn is-primary" onClick={() => void saveGateway()} disabled={busy !== null || (isFaculty && !facultyAccess?.enabled)}>{busy === "gateway" ? "Saving…" : "Save gateway"}</button>
        {currentGateway && <button className="ngx-btn is-secondary" onClick={() => void testConnection()} disabled={busy !== null}>{busy === "connection" ? "Testing…" : "Test connection"}</button>}
        {connection === "connected" && <Pill tone="good">Connected</Pill>}
        {connection === "not_connected" && <Pill tone="bad">Not connected</Pill>}
      </div>
    </>
  );

  return (
    <AppShell user={user as any} activeNav="sms-log" heading={isFaculty ? "SMS Gateway" : "Absentee SMS"} onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      <ToastPopup message={success} onClose={() => setSuccess(null)} />
      {dialog}
      <div className="ngx ngx-page">

        {/* Context first: what is the state of sending right now? */}
        <section className="ngx-strip" aria-label="Sending status">
          <div className="ngx-strip-cell">
            <div className="ngx-strip-label">Gateway</div>
            <div className="ngx-strip-value is-text"><i className={`ngx-dot is-${gatewayState.tone}`} aria-hidden="true" />{gatewayState.label}</div>
            <div className="ngx-strip-meta">{currentGateway ? `${currentGateway.gateway_name} · ${humanize(currentGateway.gateway_mode)}` : "Add one in Setup"}</div>
          </div>
          {isFaculty ? (
            <>
              <div className="ngx-strip-cell">
                <div className="ngx-strip-label">Delegated by</div>
                <div className="ngx-strip-value is-text">{facultyAccess?.hod_username || "—"}</div>
                <div className="ngx-strip-meta">Head of Department</div>
              </div>
              <div className="ngx-strip-cell">
                <div className="ngx-strip-label">Your batches</div>
                <div className="ngx-strip-value">{facultyAccess?.allowed_batches.length ?? 0}</div>
                <div className="ngx-strip-meta">{facultyAccess?.allowed_batches.map((b) => b.code || b.name).join(", ") || "None delegated"}</div>
              </div>
            </>
          ) : (
            <>
              <div className={`ngx-strip-cell${approvalRows.length ? " is-attention" : ""}`}>
                <div className="ngx-strip-label">Awaiting approval</div>
                <div className="ngx-strip-value">{approvalRows.length}</div>
                <div className="ngx-strip-meta">{blockedCount ? `${blockedCount} blocked · ` : ""}for {prettyDate(approvalDate)}</div>
              </div>
              <div className="ngx-strip-cell">
                <div className="ngx-strip-label">Daily cap</div>
                <div className="ngx-strip-value">{settings.sms_daily_cap}</div>
                <div className="ngx-strip-meta">messages per day</div>
              </div>
              <div className="ngx-strip-cell">
                <div className="ngx-strip-label">Absentee cutoff</div>
                <div className="ngx-strip-value">{clock12(settings.sms_absentee_cutoff_time)}</div>
                <div className="ngx-strip-meta">Auto worker {settings.sms_enabled === "1" ? "on" : "paused"}</div>
              </div>
            </>
          )}
        </section>

        <Tabs tabs={tabs} active={tab} onChange={setTab} label="SMS sections" />

        {/* ── Review (HOD) ───────────────────────────────────────────── */}
        {!isFaculty && (
          <TabPanel id="review" active={tab}>
            <div className="ngx-card">
              <div className="ngx-queue-bar">
                <div className="ngx-queue-date">
                  <input type="date" aria-label="Absentee date" className="ngx-input is-sm" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} />
                  {approvalRows.length > 0 && (
                    <span className="ngx-queue-summary"><b>{approvalRows.length}</b> awaiting approval{blockedCount > 0 && <> · <b>{blockedCount}</b> blocked</>}</span>
                  )}
                </div>
                {approvalRows.length > 0 && (
                  <button className="ngx-btn is-primary" onClick={() => void approve()} disabled={busy !== null}>
                    {busy === "approve" ? "Approving…" : `Approve ${approvalRows.length} message${approvalRows.length === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
              {loading && approvalRows.length === 0 ? (
                <div style={{ padding: 18, display: "grid", gap: 14 }}><div className="ngx-skel" style={{ width: "40%" }} /><div className="ngx-skel" /><div className="ngx-skel" style={{ width: "70%" }} /></div>
              ) : approvalRows.length === 0 ? (
                <EmptyState
                  title={`Nothing waiting for ${prettyDate(approvalDate)}`}
                  hint={currentGateway?.auto_send ? "Auto-send is on, so absentee messages go out without review." : "Absentee messages appear here after attendance is marked. Nothing is sent until you approve it."}
                />
              ) : (
                <div>
                  {approvalRows.map((r) => {
                    const routed = Boolean(r.gateway_id && r.gateway_active && !r.error);
                    return (
                      <div key={r.id} className={`ngx-queue-row${r.error ? " is-blocked" : ""}`}>
                        <div className="ngx-queue-who">
                          <strong>{r.student_name}</strong>
                          <span>{r.roll_no} · {r.parent_phone}{r.recipient_type === "STUDENT" ? " · Student's phone" : ""}</span>
                        </div>
                        <p className="ngx-queue-msg">{r.message}</p>
                        <div className="ngx-queue-act">
                          <div className="ngx-queue-route">
                            {r.error ? <><Pill tone="bad">Blocked</Pill><div className="ngx-cell-sub" title={r.error}>{r.error}</div></> : routed ? <div className="ngx-cell-sub" style={{ marginTop: 0 }}>via {r.gateway_name}</div> : <Pill tone="bad">No gateway</Pill>}
                          </div>
                          <div className="ngx-queue-btns">
                            <button className="ngx-btn is-secondary is-sm" disabled={busy !== null} onClick={() => void rejectOne(r)}>Reject</button>
                            <button className="ngx-btn is-primary is-sm" disabled={busy !== null || Boolean(r.error)} onClick={() => void approveOne(r)}>Approve</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabPanel>
        )}

        {/* ── Compose ────────────────────────────────────────────────── */}
        <TabPanel id="compose" active={tab}>
          <div className="ngx-card ngx-composer">
            <div className="ngx-card-body">
              {!isFaculty && (
                <div className="ngx-segment" role="group" aria-label="Message type" style={{ marginBottom: 18 }}>
                  <button type="button" className={messageType === "ABSENTEE_ALERT" ? "is-active" : ""} aria-pressed={messageType === "ABSENTEE_ALERT"} onClick={() => { setMessageType("ABSENTEE_ALERT"); setRecipient("PARENT"); setComposeText(templates.ABSENTEE_ALERT || ""); }}>Absentee alert</button>
                  <button type="button" className={messageType === "GENERAL_NOTICE" ? "is-active" : ""} aria-pressed={messageType === "GENERAL_NOTICE"} onClick={() => { setMessageType("GENERAL_NOTICE"); setRecipient("PARENT"); setComposeText(templates.GENERAL_NOTICE || ""); }}>General notice</button>
                </div>
              )}
              <div className="ngx-form-grid">
                {(isFaculty || messageType === "GENERAL_NOTICE") && (
                  <label className="ngx-field"><span>{isFaculty ? "Batch" : "Send to batch"}</span>
                    <select className="ngx-select" value={selectedBatchId ?? ""} onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Select a batch</option>
                      {batches.map((b) => <option key={b.id} value={b.id}>{b.code || b.name} ({b.student_count} students)</option>)}
                    </select>
                  </label>
                )}
                {(isFaculty || messageType === "GENERAL_NOTICE") && (
                  <div className="ngx-field" role="group" aria-labelledby="ngx-audience-label"><span id="ngx-audience-label">Send to</span>
                    <div className="ngx-segment ngx-audience">
                      <button type="button" className={recipient === "PARENT" ? "is-active" : ""} aria-pressed={recipient === "PARENT"} onClick={() => chooseRecipient("PARENT")}>Parents</button>
                      <button type="button" className={recipient === "STUDENT" ? "is-active" : ""} aria-pressed={recipient === "STUDENT"} onClick={() => chooseRecipient("STUDENT")}>Students</button>
                    </div>
                  </div>
                )}
                <label className="ngx-field"><span>{isFaculty || messageType === "GENERAL_NOTICE" ? "Message" : "Absentee message template"}</span>
                  <textarea className="ngx-textarea" value={composeText} onChange={(e) => setComposeText(e.target.value)} placeholder={recipient === "STUDENT" ? "Dear Student, {student}: {message}" : "Dear Parent, {student}: {message}"} style={{ minHeight: 120 }} />
                  <div className="ngx-counter"><span className="ngx-hint">{composeText.length} characters</span></div>
                </label>
              </div>
              <div className="ngx-form-actions">
                {isFaculty || messageType === "GENERAL_NOTICE" ? (
                  <>
                    <button className="ngx-btn is-primary" disabled={busy !== null || !selectedBatchId || !composeText.trim() || (isFaculty && !gatewayConfigured)} onClick={() => void sendGeneral()}>
                      {busy === "general" ? (isFaculty ? "Sending…" : "Queuing…") : isFaculty ? (selectedBatch ? `Send to ${selectedBatch.code || selectedBatch.name} ${recipient === "STUDENT" ? "students" : "parents"}` : "Send SMS to batch") : (selectedBatch ? `Queue for ${selectedBatch.code || selectedBatch.name} ${recipient === "STUDENT" ? "students" : "parents"}` : "Queue notice")}
                    </button>
                    {!isFaculty && recipient === "PARENT" && <button className="ngx-btn is-secondary" onClick={() => void saveTemplate()} disabled={busy !== null}>Save template</button>}
                    {isFaculty && !gatewayConfigured && <span className="ngx-hint is-warn">Set up your gateway before sending.</span>}
                  </>
                ) : (
                  <button className="ngx-btn is-primary" onClick={() => void saveTemplate()} disabled={busy !== null || !composeText.trim()}>Save template</button>
                )}
              </div>
            </div>
          </div>
        </TabPanel>

        {/* ── Activity ───────────────────────────────────────────────── */}
        <TabPanel id="activity" active={tab}>
          <SmsActivityPanel activities={smsActivity} loading={loading} />
        </TabPanel>

        {/* ── Setup ──────────────────────────────────────────────────── */}
        <TabPanel id="setup" active={tab}>
          <div className="ngx-card">
            <section className="ngx-set">
              <div className="ngx-set-head">
                <h3>{isFaculty ? "Your gateway" : "Department gateway"}</h3>
                <p>{isFaculty ? "Messages to your delegated batches go out through this phone." : "Messages for your batches go out through this phone."}</p>
                <Pill tone={gatewayState.tone}>{gatewayState.label}</Pill>
              </div>
              <div className="ngx-set-body">{gatewayForm}</div>
            </section>

            {isHod && (
              <section className="ngx-set">
                <div className="ngx-set-head">
                  <h3>Batch handlers</h3>
                  <p>Faculty who send for a batch use their own gateway. You only see routing status.</p>
                </div>
                <div className="ngx-set-body">
                  {handlers.length === 0 ? (
                    <div className="ngx-notice is-info"><Icon name="info" /><span>No Faculty has SMS access yet. Delegate it from Faculty → SMS routing.</span></div>
                  ) : handlers.map((f) => {
                    const g = gateways.find((x) => x.owner_username === f.username && x.hod_username === user.username);
                    const ready = handlerReady(f);
                    const status = g ? gatewayConnectionStatus[g.id] : undefined;
                    return (
                      <div key={f.username} className="ngx-handler">
                        <div><div className="ngx-cell-main">{f.full_name || f.username}</div><div className="ngx-cell-sub">@{f.username}</div></div>
                        <div className="ngx-chips">{(f.allowed_batches || []).length ? f.allowed_batches.map((b) => <span key={b.id} className="ngx-chip">{b.code || b.name} · {b.student_count ?? "—"}</span>) : <span className="ngx-chip is-none">No batch</span>}</div>
                        <div>
                          <div className="ngx-handler-status">
                            <Pill tone={ready ? "good" : "bad"}>{ready ? "Ready" : g ? "Not ready" : "Not configured"}</Pill>
                            {g && ready && <Pill tone={status === "connected" ? "good" : status === "not_connected" ? "bad" : "muted"} dot={false}>{status === "connected" ? "Connected" : status === "not_connected" ? "Not connected" : "Not tested"}</Pill>}
                          </div>
                          <div className="ngx-cell-sub">{g?.gateway_name || "Faculty must configure a gateway"}</div>
                        </div>
                        {g && <button className="ngx-btn is-secondary is-sm" onClick={() => void testConnection(g.id)} disabled={busy !== null || !ready}>{testingGatewayId === g.id ? "Testing…" : "Test connection"}</button>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {!isFaculty && (
              <section className="ngx-set">
                <div className="ngx-set-head">
                  <h3>Sending limits</h3>
                  <p>Caps and timing for the automatic absentee worker.</p>
                </div>
                <div className="ngx-set-body">
                  <div className="ngx-form-grid is-3">
                    <label className="ngx-field"><span>Daily SMS cap</span><input type="number" min={1} className="ngx-input" value={settings.sms_daily_cap} onChange={(e) => setSettings({ ...settings, sms_daily_cap: e.target.value })} /></label>
                    <label className="ngx-field"><span>Absentee cutoff</span><input type="time" className="ngx-input" value={settings.sms_absentee_cutoff_time} onChange={(e) => setSettings({ ...settings, sms_absentee_cutoff_time: e.target.value })} /></label>
                    <label className="ngx-field"><span>Automatic worker</span>
                      <select className="ngx-select" value={settings.sms_enabled} onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.value })}><option value="1">Enabled</option><option value="0">Disabled</option></select>
                    </label>
                  </div>
                  <div className="ngx-form-actions"><button className="ngx-btn is-primary" onClick={() => void saveOperationsSettings()} disabled={busy !== null}>{busy === "settings" ? "Saving…" : "Save limits"}</button></div>
                </div>
              </section>
            )}

            {!isFaculty && (
              <section className="ngx-set">
                <div className="ngx-set-head">
                  <h3>Test message</h3>
                  <p>Send one SMS through your gateway to confirm it works.</p>
                </div>
                <div className="ngx-set-body">
                  <div className="ngx-form-actions" style={{ marginTop: 0 }}>
                    <input className="ngx-input" style={{ maxWidth: 260 }} inputMode="tel" aria-label="Test recipient" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="10-digit mobile number" />
                    <button className="ngx-btn is-secondary" onClick={() => void sendTest()} disabled={busy !== null || !currentGateway || !testPhone.trim()}>{busy === "test-sms" ? "Sending…" : "Send test SMS"}</button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {user.username === "admin" && <AdminStudentSelfEditCard onNotification={(msg, type) => type === "success" ? setSuccess(msg) : setError(msg)} />}
        </TabPanel>
      </div>
    </AppShell>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "";
  if (iso.slice(0, 10) === today()) return "today";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

function stamp(ts: string): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(String(ts));
  if (!m) return { date: String(ts), time: "" };
  return { date: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`, time: m[4] };
}

function clock12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return hhmm || "—";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

function statusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (["CONNECTED", "SENT", "APPROVED", "DELIVERED"].includes(s)) return "good";
  if (["NOT_CONNECTED", "FAILED", "BLOCKED", "REJECTED"].includes(s)) return "bad";
  if (["QUEUED", "PENDING"].includes(s)) return "warn";
  return "muted";
}

/* ── Admin: cross-department gateway overview ────────────────────────── */

function AdminGatewayOverview({ user, onLoggedOut, gateways, activities, loading, error, onRefresh, onClearError }: {
  user: { username: string; role: string }; onLoggedOut: () => void; gateways: SmsGateway[]; activities: SmsActivityRow[];
  loading: boolean; error: string | null; onRefresh: () => void; onClearError: () => void;
}) {
  const [q, setQ] = useState(""); const [dept, setDept] = useState("ALL"); const [role, setRole] = useState("ALL"); const [status, setStatus] = useState("ALL"); const [selected, setSelected] = useState<number | null>(null);
  const departments = useMemo(() => Array.from(new Set(gateways.map((g) => g.owner_department || g.hod_department).filter(Boolean) as string[])).sort(), [gateways]);
  const filtered = useMemo(() => gateways.filter((g) => {
    const h = `${g.owner_name || ""} ${g.owner_username || ""} ${g.hod_name || ""} ${g.hod_username || ""} ${g.gateway_name} ${g.gateway_mode}`.toLowerCase();
    const r = g.is_hod_gateway ? "HOD" : "FACULTY";
    return (!q || h.includes(q.toLowerCase())) && (dept === "ALL" || (g.owner_department || g.hod_department) === dept) && (role === "ALL" || r === role) && (status === "ALL" || g.connection_status === status);
  }), [gateways, q, dept, role, status]);
  const chosen = selected ? gateways.find((g) => g.id === selected) || null : null;
  const filtersOn = Boolean(q || dept !== "ALL" || role !== "ALL" || status !== "ALL");

  return (
    <AppShell user={user as any} activeNav="sms-log" heading="SMS Gateways" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={onClearError} />
      <div className="ngx ngx-page">
        <section className="ngx-card">
          <div className="ngx-toolbar">
            <div className="ngx-search"><Icon name="search" /><input className="ngx-input is-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search owner, HOD or gateway" aria-label="Search gateways" /></div>
            <select className="ngx-select is-sm" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}><option value="ALL">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <select className="ngx-select is-sm" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="ALL">All roles</option><option value="HOD">HOD</option><option value="FACULTY">Faculty handler</option></select>
            <select className="ngx-select is-sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="CONNECTED">Connected</option><option value="NOT_CONNECTED">Not connected</option><option value="NOT_TESTED">Not tested</option></select>
            {filtersOn && <button className="ngx-btn is-link" onClick={() => { setQ(""); setDept("ALL"); setRole("ALL"); setStatus("ALL"); }}>Clear</button>}
            <span className="ngx-spacer" />
            <button className="ngx-btn is-secondary is-sm" onClick={onRefresh} disabled={loading}><Icon name="refresh" size={14} />{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
          <AdminGatewayTable title="HOD gateways" rows={filtered.filter((g) => g.is_hod_gateway)} onView={setSelected} />
          <AdminGatewayTable title="Faculty gateway handlers" rows={filtered.filter((g) => !g.is_hod_gateway)} onView={setSelected} />
        </section>
        <SmsActivityPanel activities={activities} loading={loading} />
      </div>

      {chosen && (
        <Modal title={chosen.gateway_name} size="lg" onClose={() => setSelected(null)} footer={<button className="ngx-btn is-secondary" onClick={() => setSelected(null)}>Close</button>}>
          <dl className="ngx-dl">
            <div><dt>Owner</dt><dd>{chosen.owner_name || "—"} ({chosen.owner_username || "—"})</dd></div>
            <div><dt>Role</dt><dd>{chosen.is_hod_gateway ? "HOD" : "Faculty gateway handler"}</dd></div>
            <div><dt>Department</dt><dd>{chosen.owner_department || chosen.hod_department || "—"}</dd></div>
            <div><dt>HOD</dt><dd>{chosen.hod_name || "—"} ({chosen.hod_username || "—"})</dd></div>
            <div><dt>Mode</dt><dd>{humanize(chosen.gateway_mode)}</dd></div>
            <div><dt>Connection</dt><dd>{humanize(chosen.connection_status || "NOT_TESTED")}</dd></div>
            <div><dt>Last connection test</dt><dd>{chosen.last_connection_test || "Not tested"}</dd></div>
            <div><dt>Auto-send</dt><dd>{chosen.auto_send ? "Enabled" : "Disabled"}</dd></div>
            <div><dt>Assigned batches</dt><dd>{chosen.assigned_batches?.length ? chosen.assigned_batches.map((b) => `${b.code || b.name} (${b.student_count ?? 0})`).join(", ") : "—"}</dd></div>
          </dl>
          <div className="ngx-notice is-info"><Icon name="lock" /><span>Passwords, tokens, device IDs, modem secrets and endpoint credentials are never shown to Admin.</span></div>
        </Modal>
      )}
    </AppShell>
  );
}

function AdminGatewayTable({ title, rows, onView }: { title: string; rows: SmsGateway[]; onView: (id: number) => void }) {
  return (
    <div>
      <div className="ngx-listmeta" style={{ background: "var(--ng-surface-2)" }}><strong style={{ color: "var(--ng-text)", fontSize: 13 }}>{title}</strong><span>{rows.length}</span></div>
      {rows.length === 0 ? <EmptyState title="No gateways in this group" /> : (
        <div className="ngx-table-wrap">
          <table className="ngx-table">
            <thead><tr><th>Owner</th><th>HOD / department</th><th>Gateway</th><th>Mode</th><th>Status</th><th>Last test</th><th><span style={{ position: "absolute", left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>{rows.map((g) => (
              <tr key={g.id}>
                <td><div className="ngx-cell-main">{g.owner_name || g.owner_username}</div><div className="ngx-cell-sub">{g.owner_username || "—"}</div></td>
                <td>{g.hod_name || g.hod_username}<div className="ngx-cell-sub">{g.hod_department || g.owner_department || "—"}</div></td>
                <td>{g.gateway_name}</td>
                <td className="is-quiet">{humanize(g.gateway_mode)}</td>
                <td><Pill tone={statusTone(g.connection_status || "NOT_TESTED")}>{humanize(g.connection_status || "NOT_TESTED")}</Pill></td>
                <td className="is-quiet is-nowrap">{g.last_connection_test || "—"}</td>
                <td className="is-right"><button className="ngx-btn is-secondary is-sm" onClick={() => onView(g.id)}>View</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Activity log ────────────────────────────────────────────────────── */

function SmsActivityPanel({ activities, loading }: { activities: SmsActivityRow[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 25;

  const actions = useMemo(() => Array.from(new Set(activities.map((a) => a.action))).sort(), [activities]);
  const roles = useMemo(() => Array.from(new Set(activities.map((a) => a.role))).sort(), [activities]);
  const statuses = useMemo(() => Array.from(new Set(activities.map((a) => a.status))).sort(), [activities]);
  const filtered = useMemo(() => activities.filter((a) => {
    const haystack = `${a.actor} ${a.role} ${a.action} ${a.gateway} ${a.batch} ${a.status} ${a.details}`.toLowerCase();
    const day = String(a.timestamp).slice(0, 10);
    return (!search || haystack.includes(search.toLowerCase()))
      && (role === "ALL" || a.role === role)
      && (action === "ALL" || a.action === action)
      && (status === "ALL" || a.status === status)
      && (!from || day >= from)
      && (!to || day <= to);
  }), [activities, search, role, action, status, from, to]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, filtered.length);
  const activeCount = [role !== "ALL", action !== "ALL", status !== "ALL", Boolean(from || to), Boolean(search)].filter(Boolean).length;
  const filtersActive = activeCount > 0;

  useEffect(() => { setPage(1); }, [search, role, action, status, from, to]);

  const clearFilters = () => { setSearch(""); setRole("ALL"); setAction("ALL"); setStatus("ALL"); setFrom(""); setTo(""); };
  const toggle = (id: number) => setExpandedId((cur) => (cur === id ? null : id));

  return (
    <section className="ngx-card">
      <div className="ngx-filterbar">
        <div className="ngx-search"><Icon name="search" /><input className="ngx-input is-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, gateway, batch" aria-label="Search activity" /></div>
        <button type="button" className="ngx-btn is-secondary is-sm ngx-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          <Icon name="filter" size={14} />Filters{activeCount ? ` · ${activeCount}` : ""}
        </button>
        <div className={`ngx-filter-fields${filtersOpen ? " is-open" : ""}`}>
          <select className="ngx-select is-sm" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="ALL">All roles</option>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <select className="ngx-select is-sm" aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}><option value="ALL">All actions</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select className="ngx-select is-sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select>
          <span className="ngx-date"><input type="date" aria-label="From date" className="ngx-input is-sm" value={from} onChange={(e) => setFrom(e.target.value)} />to<input type="date" aria-label="To date" className="ngx-input is-sm" value={to} onChange={(e) => setTo(e.target.value)} /></span>
        </div>
        {filtersActive && <button type="button" className="ngx-btn is-link" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="ngx-listmeta">
        <span>{rangeStart ? `${rangeStart}–${rangeEnd} of ${filtered.length}` : "0 records"}{filtersActive && filtered.length !== activities.length ? ` (filtered from ${activities.length})` : ""}</span>
      </div>

      {loading && activities.length === 0 ? (
        <div style={{ padding: 18, display: "grid", gap: 14 }}>{[60, 100, 80, 90].map((w, i) => <div key={i} className="ngx-skel" style={{ width: `${w}%` }} />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState title={filtersActive ? "No activity matches these filters" : "No activity yet"} hint={filtersActive ? undefined : "Gateway tests, approvals and sends will be recorded here."} action={filtersActive ? <button className="ngx-btn is-secondary is-sm" onClick={clearFilters}>Clear filters</button> : undefined} />
      ) : (
        <>
          <div className="ngx-table-wrap ngx-act-table">
            <table className="ngx-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Gateway</th><th>Batch</th><th className="is-num">SMS</th><th>Status</th><th aria-label="Details" /></tr></thead>
              <tbody>{visible.map((a) => {
                const t = stamp(a.timestamp);
                const open = expandedId === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr className={`ngx-act-row${open ? " is-open" : ""}`} onClick={() => toggle(a.id)} tabIndex={0} aria-expanded={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(a.id); } }}>
                      <td><span className="ngx-time" title={String(a.timestamp)}>{t.date}<span>{t.time}</span></span></td>
                      <td><div className="ngx-cell-main">{a.actor}</div><div className="ngx-cell-sub">{a.role}</div></td>
                      <td>{a.action}</td>
                      <td className="is-quiet">{a.gateway || "—"}</td>
                      <td className="is-quiet">{a.batch || "—"}</td>
                      <td className="is-num">{a.sms_count}</td>
                      <td><Pill tone={statusTone(a.status)}>{humanize(a.status)}</Pill></td>
                      <td className="is-right"><span className="ngx-chev" style={{ display: "inline-flex" }}><Icon name="chevronRight" size={15} /></span></td>
                    </tr>
                    {open && <tr className="ngx-act-detail"><td colSpan={8}><b>Details</b><p>{a.details || "No additional details recorded."}</p></td></tr>}
                  </Fragment>
                );
              })}</tbody>
            </table>
          </div>

          <div className="ngx-cards">
            {visible.map((a) => {
              const t = stamp(a.timestamp);
              return (
                <button key={a.id} type="button" className="ngx-act-card" aria-expanded={expandedId === a.id} onClick={() => toggle(a.id)}>
                  <div className="ngx-act-card-top">
                    <div><strong>{a.action}</strong><span className="ngx-sub">{a.actor} · {a.role}</span></div>
                    <Pill tone={statusTone(a.status)}>{humanize(a.status)}</Pill>
                  </div>
                  <div className="ngx-act-card-meta"><span>{a.gateway || "—"}</span>{a.batch && <span>{a.batch}</span>}<span>{a.sms_count} SMS</span></div>
                  <time dateTime={String(a.timestamp)}>{t.date} · {t.time}</time>
                  {expandedId === a.id && <div className="ngx-act-card-detail">{a.details || "No additional details recorded."}</div>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="ngx-pager">
        <span>Page {page} of {pageCount}</span>
        <div>
          <button className="ngx-btn is-secondary is-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
          <button className="ngx-btn is-secondary is-sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>Next</button>
        </div>
      </div>
    </section>
  );
}
