// Group 5 — Faculty page for HOD.
// Mirrors webapp/routes/faculty.py + templates/faculty/list.html.
// Sections are COLLAPSED BY DEFAULT, expanding on click.
// All errors/failures displayed in RED (.error-banner)
import { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import { EmptyState, Icon, Modal, Switch, TabPanel, Tabs, initials, type TabDef } from "../../components/ngx";
import {
  getFacultyPage, createAccount, toggleAccountStatus, resetStudentPassword, deleteAccount,
  saveRolePermissions, getUserPermissions, saveUserPermissions,
  type FacultyPageData, type UserAccount, type RolePermission, type UserPermission,
  getSmsAccessControl, saveSmsAccess, saveSmsBatchHandler,
  type FacultySmsAccessData, type FacultySmsAccessRow,
} from "../../api/faculty";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function FacultyPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<FacultyPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Collapsible state — collapsed by default
  const [tab, setTab] = useState("accounts");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [smsAccess, setSmsAccess] = useState<FacultySmsAccessData | null>(null);
  const [smsAccessFaculty, setSmsAccessFaculty] = useState<FacultySmsAccessRow | null>(null);
  const [smsAccessEnabled, setSmsAccessEnabled] = useState(false);
  const [smsBatchIds, setSmsBatchIds] = useState<number[]>([]);
  const [loadingSmsAccess, setLoadingSmsAccess] = useState(false);
  const [savingSmsAccess, setSavingSmsAccess] = useState(false);
  const [savingBatchHandlerId, setSavingBatchHandlerId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [revealedCreds, setRevealedCreds] = useState<{ username: string; password: string } | null>(null);

  // Profile Access Selector Modal State
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null);
  const [userPerms, setUserPerms] = useState<UserPermission | null>(null);
  const [loadingUserPerms, setLoadingUserPerms] = useState(false);
  const [savingUserPerms, setSavingUserPerms] = useState(false);

  // Permanent Delete Modal State
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteKeyInput, setDeleteKeyInput] = useState("");

  // Create form state
  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "HOD" | "FACULTY">("FACULTY");

  // Permissions state
  const [facultyPerms, setFacultyPerms] = useState<RolePermission>({
    role: "FACULTY",
    can_view_student_phone: 1,
    can_edit_students: 0,
    can_delete_students: 0,
    can_view_audit_logs: 0,
    can_view_sms_logs: 0,
    can_manage_calendar: 1,
    can_manage_subjects: 1,
  });

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const d = await getFacultyPage();
      setData(d);
      if (d.permissions) {
        const fac = d.permissions.find(p => p.role === "FACULTY");
        if (fac) setFacultyPerms(fac);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load faculty page");
    } finally {
      setLoading(false);
    }
  }

  async function loadSmsDelegation() {
    setLoadingSmsAccess(true);
    try {
      const d = await getSmsAccessControl();
      setSmsAccess(d);
      if (smsAccessFaculty) {
        const fresh = d.faculty.find((f) => f.username === smsAccessFaculty.username) || null;
        setSmsAccessFaculty(fresh);
        if (fresh) {
          setSmsAccessEnabled(fresh.enabled);
          setSmsBatchIds(fresh.allowed_batches.map((b) => b.id));
        }
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load SMS Gateway delegation");
    } finally {
      setLoadingSmsAccess(false);
    }
  }

  async function handleAssignBatchHandler(semesterId: number, handlerUsername: string) {
    setSavingBatchHandlerId(semesterId);
    try {
      const { batch_handlers } = await saveSmsBatchHandler(semesterId, handlerUsername);
      setSmsAccess((prev) => (prev ? { ...prev, batch_handlers } : prev));
      setNotice(handlerUsername === user.username ? "Batch assigned to yourself (HOD)" : `Batch assigned to ${handlerUsername}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to assign batch handler");
    } finally {
      setSavingBatchHandlerId(null);
    }
  }

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpenProfilePermissions(acc: UserAccount) {
    setSelectedAccount(acc);
    setLoadingUserPerms(true);
    setError(null);
    try {
      const res = await getUserPermissions(acc.username);
      setUserPerms(res.permissions);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load profile permissions");
    } finally {
      setLoadingUserPerms(false);
    }
  }

  async function handleToggleUserPermission(key: keyof UserPermission) {
    if (!userPerms || key === "username") return;
    const updated = { ...userPerms, [key]: userPerms[key] ? 0 : 1 };
    setUserPerms(updated);
  }

  async function handleSaveProfilePermissions() {
    if (!selectedAccount || !userPerms) return;
    setSavingUserPerms(true);
    setError(null);
    try {
      await saveUserPermissions(selectedAccount.username, userPerms);
      setNotice(`Access permissions saved for ${selectedAccount.full_name || selectedAccount.username}`);
      setSelectedAccount(null);
      setUserPerms(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save user permissions");
    } finally {
      setSavingUserPerms(false);
    }
  }

  async function handleTogglePermission(key: keyof RolePermission) {
    if (key === "role") return;
    const newVal = facultyPerms[key] ? 0 : 1;
    const updated = { ...facultyPerms, [key]: newVal };
    setFacultyPerms(updated);
    try {
      await saveRolePermissions(updated);
      setNotice(`Faculty permission updated successfully`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save permission");
      setFacultyPerms(facultyPerms);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAccount({
        username: formUsername,
        full_name: formFullName,
        password: formPassword,
        role: formRole,
      });
      setFormUsername(""); setFormFullName(""); setFormPassword("");
      setFormRole("FACULTY");
      setShowCreateForm(false);
      setNotice("Account created successfully");
      await reload();
      // The SMS delegation panel keeps its own snapshot. Refresh it too so a
      // newly-created Faculty appears immediately as an assignable handler.
      if (smsAccess || tab === "routing") {
        await loadSmsDelegation();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(account: UserAccount) {
    setError(null);
    try {
      await toggleAccountStatus(account.id);
      setNotice(`${account.username} ${account.active ? "deactivated" : "activated"}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to toggle status");
    }
  }

  async function handleResetPassword(account: UserAccount) {
    if (!window.confirm(`Reset password for ${account.username}? A new temporary password will be set.`)) return;
    setError(null);
    try {
      const res = await resetStudentPassword(account.id);
      setRevealedCreds({ username: res.username, password: res.password });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reset password");
    }
  }

  async function handleConfirmDeleteAccount() {
    if (!accountToDelete) return;
    setDeletingAccount(true);
    setError(null);
    try {
      await deleteAccount(accountToDelete.id);
      setNotice(`User account "${accountToDelete.username}" has been permanently deleted.`);
      // Immediately remove from data.accounts in React state so UI updates instantly
      setData((prev) => prev ? { ...prev, accounts: prev.accounts.filter(a => a.id !== accountToDelete.id) } : prev);
      setAccountToDelete(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleSaveSmsAccess() {
    if (!smsAccessFaculty) return;
    setSavingSmsAccess(true);
    try {
      await saveSmsAccess(smsAccessFaculty.username, { enabled: smsAccessEnabled, batch_ids: smsAccessEnabled ? smsBatchIds : [] });
      setNotice(`SMS Gateway access updated for ${smsAccessFaculty.username}`);
      setSmsAccessFaculty(null);
      setSmsBatchIds([]);
      await loadSmsDelegation();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save SMS Gateway access");
    } finally {
      setSavingSmsAccess(false);
    }
  }

  function openTab(id: string) {
    setTab(id);
    if (id === "routing") void loadSmsDelegation();
  }

  const accounts = data?.accounts ?? [];
  const needle = query.trim().toLowerCase();
  const visibleAccounts = accounts.filter((a) =>
    (roleFilter === "ALL" || a.role === roleFilter) &&
    (!needle || `${a.username} ${a.full_name || ""}`.toLowerCase().includes(needle)));
  const canManage = (a: UserAccount) => a.role !== "HOD" && a.role !== "ADMIN" && a.username !== user.username && a.username !== "admin";
  const maxHours = Math.max(1, ...(data?.hours ?? []).map((h) => h.total_hours));
  const filtersOn = Boolean(needle || roleFilter !== "ALL");

  const tabs: TabDef[] = [
    { id: "accounts", label: "Accounts", count: loading ? null : accounts.length },
    { id: "permissions", label: "Permissions" },
    { id: "routing", label: "SMS routing" },
    { id: "hours", label: "Teaching hours" },
  ];

  const roleChip = (role: UserAccount["role"]) => <span className={`ngx-role${role === "ADMIN" ? " is-admin" : role === "HOD" ? " is-hod" : ""}`}>{role}</span>;
  const statusText = (active: boolean) => <span className="ngx-status"><i className={`ngx-dot${active ? " is-good" : ""}`} aria-hidden="true" />{active ? "Active" : "Inactive"}</span>;

  const rowActions = (acc: UserAccount) => (
    <>
      <button className="ngx-btn is-secondary is-sm" onClick={() => void handleOpenProfilePermissions(acc)}>Edit access</button>
      {canManage(acc) ? (
        <>
          <button className="ngx-btn is-ghost is-sm" onClick={() => void handleToggle(acc)}>{acc.active ? "Deactivate" : "Activate"}</button>
          <button className="ngx-icon-btn is-danger" aria-label={`Delete ${acc.username}`} title="Delete account" onClick={() => { setAccountToDelete(acc); setDeleteKeyInput(""); }}><Icon name="trash" /></button>
        </>
      ) : (
        <><span /><span /></>
      )}
      {acc.role === "STUDENT" && acc.student_roll_no && <button className="ngx-btn is-ghost is-sm" onClick={() => void handleResetPassword(acc)}>Reset password</button>}
    </>
  );

  const permRow = (key: string, label: string, desc: string, checked: boolean, onChange: () => void, sensitive?: boolean) => (
    <div key={key} className={`ngx-perm-row${sensitive ? " is-sensitive" : ""}`}>
      <div><strong>{label}</strong><small>{desc}</small></div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );

  return (
    <AppShell user={user} activeNav="faculty" heading="Faculty" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      <div className="ngx ngx-page">
        <Tabs tabs={tabs} active={tab} onChange={openTab} label="Faculty sections" />

        {/* ── Accounts ─────────────────────────────────────────────── */}
        <TabPanel id="accounts" active={tab}>
          <section className="ngx-card">
            <div className="ngx-toolbar">
              <div className="ngx-search"><Icon name="search" /><input className="ngx-input is-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or username" aria-label="Search accounts" /></div>
              <select className="ngx-select is-sm" aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="ALL">All roles</option><option value="ADMIN">Admin</option><option value="HOD">HOD</option><option value="FACULTY">Faculty</option>
              </select>
              {filtersOn && <button className="ngx-btn is-link" onClick={() => { setQuery(""); setRoleFilter("ALL"); }}>Clear</button>}
              <span className="ngx-spacer" />
              <span className="ngx-count">{filtersOn ? `${visibleAccounts.length} of ${accounts.length}` : `${accounts.length} account${accounts.length === 1 ? "" : "s"}`}</span>
              <button className="ngx-btn is-primary" onClick={() => setShowCreateForm(true)}><Icon name="plus" size={15} />Create account</button>
            </div>

            {loading ? (
              <div style={{ padding: 18, display: "grid", gap: 18 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="ngx-skel" style={{ height: 34 }} />)}</div>
            ) : visibleAccounts.length === 0 ? (
              <EmptyState
                title={filtersOn ? "No accounts match" : "No accounts yet"}
                hint={filtersOn ? "Try a different name or role." : "Create the first Faculty account to get started."}
                action={filtersOn ? <button className="ngx-btn is-secondary is-sm" onClick={() => { setQuery(""); setRoleFilter("ALL"); }}>Clear filters</button> : <button className="ngx-btn is-primary is-sm" onClick={() => setShowCreateForm(true)}>Create account</button>}
              />
            ) : (
              <>
                <div className="ngx-table-wrap ngx-acct-table">
                  <table className="ngx-table">
                    <thead><tr><th>Name</th><th>Role</th><th>Status</th><th><span style={{ position: "absolute", left: -9999 }}>Actions</span></th></tr></thead>
                    <tbody>{visibleAccounts.map((acc) => (
                      <tr key={acc.id}>
                        <td>
                          <div className={`ngx-person${acc.active ? "" : " is-off"}`}>
                            <span className="ngx-avatar" aria-hidden="true">{initials(acc.full_name || acc.username)}</span>
                            <div><div className="ngx-cell-main" title={acc.full_name || acc.username}>{acc.full_name || acc.username}</div><div className="ngx-cell-sub" title={acc.username}>@{acc.username}</div></div>
                          </div>
                        </td>
                        <td>{roleChip(acc.role)}</td>
                        <td>{statusText(acc.active)}</td>
                        <td><div className="ngx-row-actions">{rowActions(acc)}</div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

                <div className="ngx-acct-cards">
                  {visibleAccounts.map((acc) => (
                    <article key={acc.id} className="ngx-acct-card">
                      <div className="ngx-acct-card-top">
                        <div className={`ngx-person${acc.active ? "" : " is-off"}`}>
                          <span className="ngx-avatar" aria-hidden="true">{initials(acc.full_name || acc.username)}</span>
                          <div><div className="ngx-cell-main">{acc.full_name || acc.username}</div><div className="ngx-cell-sub">@{acc.username}</div></div>
                        </div>
                        <div className="ngx-acct-card-tags">{roleChip(acc.role)}</div>
                      </div>
                      <div className="ngx-acct-card-top">{statusText(acc.active)}<div className="ngx-acct-card-actions">{rowActions(acc)}</div></div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </TabPanel>

        {/* ── Faculty permissions (role-level) ─────────────────────── */}
        <TabPanel id="permissions" active={tab}>
          <section className="ngx-card">
            <div className="ngx-card-head">
              <div>
                <h2>Faculty permissions</h2>
                <p className="ngx-card-sub">Applies to every Faculty account in your scope. Changes save immediately.</p>
              </div>
            </div>
            {ROLE_PERM_GROUPS.map((g) => (
              <div key={g.title} className="ngx-perm-group">
                <h3>{g.title}</h3>
                {g.items.map((it) => permRow(it.key, it.label, it.desc, Boolean(facultyPerms[it.key]), () => void handleTogglePermission(it.key), it.sensitive))}
              </div>
            ))}
          </section>
        </TabPanel>

        {/* ── SMS routing ──────────────────────────────────────────── */}
        <TabPanel id="routing" active={tab}>
          {user.role === "HOD" && (
            <section className="ngx-card">
              <div className="ngx-card-head">
                <div>
                  <h2>Batch handlers</h2>
                  <p className="ngx-card-sub">Each batch has exactly one sender: you, or a Faculty with gateway access.</p>
                </div>
              </div>
              {loadingSmsAccess && !smsAccess ? (
                <div style={{ padding: 18, display: "grid", gap: 16 }}>{[0, 1, 2].map((i) => <div key={i} className="ngx-skel" style={{ height: 30 }} />)}</div>
              ) : !smsAccess ? (
                <EmptyState title="Batch handlers unavailable" hint="Reopen this tab to try again." />
              ) : (
                <>
                  {smsAccess.faculty.filter((f) => f.enabled && f.active).length === 0 && (
                    <div style={{ padding: "14px 18px 0" }}><div className="ngx-notice is-info"><Icon name="info" /><span>No Faculty has SMS gateway access yet. Grant it below to hand a batch off.</span></div></div>
                  )}
                  {(smsAccess.batch_handlers || []).length === 0 ? (
                    <EmptyState title="No active batches" hint="Batches in your scope will be listed here." />
                  ) : (smsAccess.batch_handlers || []).map((b) => {
                    const enabledFaculty = smsAccess.faculty.filter((f) => f.enabled && f.active);
                    const inList = b.handler_username === user.username || enabledFaculty.some((f) => f.username === b.handler_username);
                    return (
                      <div key={b.id} className="ngx-route-row is-2">
                        <div><div className="ngx-cell-main">{b.code || b.name}</div><div className="ngx-cell-sub">{b.student_count} students</div></div>
                        <select
                          className="ngx-select is-sm"
                          aria-label={`Handler for ${b.code || b.name}`}
                          value={b.handler_username}
                          disabled={savingBatchHandlerId === b.id}
                          onChange={(e) => void handleAssignBatchHandler(b.id, e.target.value)}
                        >
                          <option value={user.username}>Me (HOD)</option>
                          {!inList && <option value={b.handler_username}>{b.handler_full_name || b.handler_username}</option>}
                          {enabledFaculty.map((f) => <option key={f.username} value={f.username}>{f.full_name || f.username}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          )}

          <section className="ngx-card">
            <div className="ngx-card-head">
              <div>
                <h2>Gateway access</h2>
                <p className="ngx-card-sub">Grants SMS gateway access only. Attendance, marks and student permissions are unchanged.</p>
              </div>
            </div>
            {loadingSmsAccess && !smsAccess ? (
              <div style={{ padding: 18, display: "grid", gap: 16 }}>{[0, 1, 2].map((i) => <div key={i} className="ngx-skel" style={{ height: 30 }} />)}</div>
            ) : !smsAccess ? (
              <EmptyState title="Gateway access unavailable" hint="Reopen this tab to try again." />
            ) : smsAccess.faculty.length === 0 ? (
              <EmptyState title="No Faculty accounts" hint="Create a Faculty account first." />
            ) : smsAccess.faculty.map((fac) => (
              <div key={fac.username} className="ngx-route-row">
                <div className={`ngx-person${fac.active ? "" : " is-off"}`}>
                  <span className="ngx-avatar" aria-hidden="true">{initials(fac.full_name || fac.username)}</span>
                  <div><div className="ngx-cell-main">{fac.full_name || fac.username}</div><div className="ngx-cell-sub">@{fac.username}</div></div>
                </div>
                <div className="ngx-chips">
                  {fac.enabled
                    ? (fac.allowed_batches.length ? fac.allowed_batches.map((b) => <span key={b.id} className="ngx-chip">{b.code || b.name}</span>) : <span className="ngx-chip is-none">No batch delegated</span>)
                    : <span className="ngx-hint">No access</span>}
                </div>
                <button className={`ngx-btn is-sm ${fac.enabled ? "is-secondary" : "is-primary"}`} onClick={() => { setSmsAccessFaculty(fac); setSmsAccessEnabled(fac.enabled); setSmsBatchIds(fac.allowed_batches.map((b) => b.id)); }}>{fac.enabled ? "Manage" : "Grant access"}</button>
              </div>
            ))}
          </section>
        </TabPanel>

        {/* ── Teaching hours ───────────────────────────────────────── */}
        <TabPanel id="hours" active={tab}>
          <section className="ngx-card">
            {!data || data.hours.length === 0 ? (
              <EmptyState title="No sessions recorded yet" hint="Hours appear here once Faculty mark attendance." />
            ) : (
              <div className="ngx-table-wrap">
                <table className="ngx-table ngx-hours-table">
                  <thead><tr><th>Faculty</th><th className="is-right">Hours taught</th></tr></thead>
                  <tbody>{data.hours.map((h) => (
                    <tr key={h.faculty_username}>
                      <td><div className="ngx-person"><span className="ngx-avatar" aria-hidden="true">{initials(h.full_name || h.faculty_username)}</span><div><div className="ngx-cell-main">{h.full_name || h.faculty_username}</div><div className="ngx-cell-sub">@{h.faculty_username}</div></div></div></td>
                      <td><div className="ngx-bar"><div className="ngx-bar-track"><div className="ngx-bar-fill" style={{ width: `${(h.total_hours / maxHours) * 100}%` }} /></div><span className="ngx-num" style={{ minWidth: 36, textAlign: "right", fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{h.total_hours}</span></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </TabPanel>
      </div>

      {/* ── Create account ─────────────────────────────────────────── */}
      {showCreateForm && (
        <Modal
          title="Create account"
          onClose={() => setShowCreateForm(false)}
          locked={submitting}
          footer={<><button type="button" className="ngx-btn is-secondary" onClick={() => setShowCreateForm(false)} disabled={submitting}>Cancel</button><button type="submit" form="create-account-form" className="ngx-btn is-primary" disabled={submitting}>{submitting ? "Creating…" : "Create account"}</button></>}
        >
          <form id="create-account-form" onSubmit={handleCreate} className="ngx-form-grid">
            <label className="ngx-field"><span>Username</span><input className="ngx-input" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} autoComplete="off" required /></label>
            <label className="ngx-field"><span>Full name <em>· optional</em></span><input className="ngx-input" value={formFullName} onChange={(e) => setFormFullName(e.target.value)} autoComplete="off" /></label>
            <label className="ngx-field"><span>Temporary password</span><input type="password" className="ngx-input" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} autoComplete="new-password" required /></label>
            <label className="ngx-field"><span>Role</span>
              <select className="ngx-select" value={formRole} onChange={(e) => setFormRole(e.target.value as "ADMIN" | "HOD" | "FACULTY")}>
                <option value="FACULTY">Faculty</option>
                {user.role === "ADMIN" && <option value="HOD">HOD</option>}
                {user.role === "ADMIN" && <option value="ADMIN">Admin</option>}
              </select>
            </label>
          </form>
        </Modal>
      )}

      {/* ── Per-account access ─────────────────────────────────────── */}
      {selectedAccount && (
        <Modal
          title={`Access · ${selectedAccount.full_name || selectedAccount.username}`}
          size="md"
          onClose={() => setSelectedAccount(null)}
          locked={savingUserPerms}
          footer={
            <>
              {selectedAccount.role !== "HOD" && selectedAccount.username !== user.username && (
                <button type="button" className="ngx-btn is-danger foot-left ngx-foot-left" onClick={() => { const target = selectedAccount; setSelectedAccount(null); setAccountToDelete(target); setDeleteKeyInput(""); }}>Delete account…</button>
              )}
              <button type="button" className="ngx-btn is-secondary" onClick={() => setSelectedAccount(null)} disabled={savingUserPerms}>Cancel</button>
              <button type="button" className="ngx-btn is-primary" onClick={handleSaveProfilePermissions} disabled={savingUserPerms || !userPerms}>{savingUserPerms ? "Saving…" : "Save access"}</button>
            </>
          }
        >
          <label className="ngx-field"><span>Account</span>
            <select className="ngx-select" value={selectedAccount.username} onChange={(e) => { const target = accounts.find((a) => a.username === e.target.value); if (target) void handleOpenProfilePermissions(target); }}>
              {accounts.map((acc) => <option key={acc.username} value={acc.username}>{acc.full_name ? `${acc.full_name} (@${acc.username})` : `@${acc.username}`} · {acc.role}</option>)}
            </select>
          </label>
          {loadingUserPerms ? (
            <div style={{ display: "grid", gap: 16 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} className="ngx-skel" style={{ height: 28 }} />)}</div>
          ) : userPerms ? (
            <div className="ngx-modal-perms">
              {USER_PERM_GROUPS.map((g) => (
                <div key={g.title} className="ngx-perm-group">
                  <h3>{g.title}</h3>
                  {g.items.map((it) => permRow(it.key, it.label, it.desc, Boolean(userPerms[it.key]), () => handleToggleUserPermission(it.key), it.sensitive))}
                </div>
              ))}
            </div>
          ) : null}
        </Modal>
      )}

      {/* ── SMS gateway access ─────────────────────────────────────── */}
      {smsAccessFaculty && smsAccess && (
        <Modal
          title={`SMS gateway · ${smsAccessFaculty.full_name || smsAccessFaculty.username}`}
          onClose={() => setSmsAccessFaculty(null)}
          locked={savingSmsAccess}
          footer={<><button type="button" className="ngx-btn is-secondary" onClick={() => setSmsAccessFaculty(null)} disabled={savingSmsAccess}>Cancel</button><button type="button" className="ngx-btn is-primary" onClick={() => void handleSaveSmsAccess()} disabled={savingSmsAccess}>{savingSmsAccess ? "Saving…" : "Save access"}</button></>}
        >
          <div className="ngx-toggle-row" style={{ padding: 0 }}>
            <div><strong>SMS gateway access</strong><small>Only batches in your scope can be selected. The server re-checks this on save and on send.</small></div>
            <Switch label="SMS gateway access" checked={smsAccessEnabled} onChange={setSmsAccessEnabled} />
          </div>
          {smsAccessEnabled ? (
            <div>
              <div className="ngx-label" style={{ marginBottom: 8 }}>Batches this person can message</div>
              <div className="ngx-check-list">
                {smsAccess.batches.map((b) => {
                  const on = smsBatchIds.includes(b.id);
                  return (
                    <label key={b.id} className={`ngx-check-row${on ? " is-checked" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => setSmsBatchIds((old) => on ? old.filter((id) => id !== b.id) : [...old, b.id])} />
                      <b>{b.code || b.name}</b><span>{b.student_count} students</span>
                    </label>
                  );
                })}
                {!smsAccess.batches.length && <EmptyState title="No active batches in your scope" />}
              </div>
            </div>
          ) : (
            <div className="ngx-notice"><Icon name="alert" /><span>Turning access off removes all delegated batches as soon as you save.</span></div>
          )}
        </Modal>
      )}

      {/* ── Password reset result ──────────────────────────────────── */}
      {revealedCreds && (
        <Modal title="Password reset" size="sm" onClose={() => setRevealedCreds(null)} footer={<button type="button" className="ngx-btn is-primary" onClick={() => setRevealedCreds(null)}>Done</button>}>
          <p>Share these credentials with the user. The password is shown only once.</p>
          <div className="ngx-cred"><span>Username</span><code>{revealedCreds.username}</code></div>
          <div className="ngx-cred"><span>Temporary password</span><code>{revealedCreds.password}</code></div>
        </Modal>
      )}

      {/* ── Permanent delete ───────────────────────────────────────── */}
      {accountToDelete && (() => {
        const isKeyValid = deleteKeyInput.trim().toUpperCase() === "DELETE" ||
          deleteKeyInput.trim().toLowerCase() === accountToDelete.username.toLowerCase();
        return (
          <Modal
            title={`Delete @${accountToDelete.username}?`}
            tone="danger"
            size="sm"
            onClose={() => setAccountToDelete(null)}
            locked={deletingAccount}
            footer={<><button type="button" className="ngx-btn is-secondary" onClick={() => setAccountToDelete(null)} disabled={deletingAccount} data-autofocus="">Cancel</button><button type="button" className="ngx-btn is-danger-solid" onClick={handleConfirmDeleteAccount} disabled={deletingAccount || !isKeyValid}>{deletingAccount ? "Deleting…" : "Delete permanently"}</button></>}
          >
            <div className="ngx-person">
              <span className="ngx-avatar" aria-hidden="true">{initials(accountToDelete.full_name || accountToDelete.username)}</span>
              <div><div className="ngx-cell-main">{accountToDelete.full_name || accountToDelete.username}</div><div className="ngx-cell-sub">{accountToDelete.role}{accountToDelete.department ? ` · ${accountToDelete.department}` : ""}</div></div>
            </div>
            <ul className="ngx-list">
              <li>Login and credentials are removed for good.</li>
              <li>Subject mappings and permissions are cleared.</li>
              <li>This cannot be undone.</li>
            </ul>
            <label className="ngx-field">
              <span>Type <b>DELETE</b> or <b>{accountToDelete.username}</b> to confirm</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input className={`ngx-input ngx-confirm-input${isKeyValid ? " is-valid" : ""}`} value={deleteKeyInput} onChange={(e) => setDeleteKeyInput(e.target.value)} autoComplete="off" />
                <button type="button" className="ngx-btn is-ghost" onClick={() => setDeleteKeyInput(accountToDelete.username)}>Use username</button>
              </div>
            </label>
          </Modal>
        );
      })()}
    </AppShell>
  );
}

type RoleKey = Exclude<keyof RolePermission, "role">;
type UserKey = Exclude<keyof UserPermission, "username">;
interface PermItem<K> { key: K; label: string; desc: string; sensitive?: boolean }

const ROLE_PERM_GROUPS: { title: string; items: PermItem<RoleKey>[] }[] = [
  { title: "Students", items: [
    { key: "can_view_student_phone", label: "View contact details", desc: "See student phone numbers" },
    { key: "can_edit_students", label: "Edit student records", desc: "Change student profiles and data" },
    { key: "can_delete_students", label: "Delete student profiles", desc: "Remove student accounts", sensitive: true },
  ] },
  { title: "Academics", items: [
    { key: "can_manage_calendar", label: "Calendar and timetables", desc: "Upload timetables" },
    { key: "can_manage_subjects", label: "Subjects and allocations", desc: "Edit course subjects" },
  ] },
  { title: "Records", items: [
    { key: "can_view_sms_logs", label: "SMS logs and gateway", desc: "Trigger absentee SMS alerts" },
    { key: "can_view_audit_logs", label: "Audit logs", desc: "View the administrative audit trail", sensitive: true },
  ] },
];

const USER_PERM_GROUPS: { title: string; items: PermItem<UserKey>[] }[] = [
  { title: "Students", items: [
    { key: "can_view_students", label: "View student profiles", desc: "Directory and individual profiles" },
    { key: "can_edit_students", label: "Edit student data", desc: "Change student information" },
    { key: "can_delete_students", label: "Delete student records", desc: "Permanently remove students", sensitive: true },
  ] },
  { title: "Academics", items: [
    { key: "can_manage_attendance", label: "Mark and manage attendance", desc: "Record and correct attendance" },
    { key: "can_manage_subjects", label: "Manage subjects", desc: "Subjects and faculty mapping" },
    { key: "can_manage_calendar", label: "Calendar and timetables", desc: "Academic calendar and schedules" },
  ] },
  { title: "Records", items: [
    { key: "can_view_sms_logs", label: "SMS logs and gateway", desc: "Absentee SMS logs and phone gateway" },
    { key: "can_view_audit_logs", label: "Audit trail", desc: "System audit logs", sensitive: true },
  ] },
];
