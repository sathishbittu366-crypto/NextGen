// Group 6 — My Profile page for STUDENT.
// Mirrors webapp/routes/student_self.py + templates/student_self/profile.html.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import {
  getMyProfile, updateMyProfile, uploadMyProfilePhoto, deleteMyProfilePhoto, changeMyProfilePassword,
  type StudentSelf,
} from "../../api/me";
import { ApiClientError, formatPhotoUrl } from "../../api/client";
import { logout, type CurrentUser } from "../../api/auth";
import "../../styles/ng-flat-controls.css";
import "./profile.css";
import "../../styles/ng-flat-controls.css";
import "./profile.css";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

type Kind = "text" | "gender" | "category" | "seat" | "dob";
interface FieldDef { label: string; key: keyof StudentSelf; kind?: Kind; inputType?: string; wide?: boolean; editOnly?: boolean }

// Name sits in the header while reading, so it only appears as a field when editing.
const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  { title: "Personal", fields: [
    { label: "Full name", key: "name", editOnly: true, wide: true },
    { label: "Father's name", key: "father_name" },
    { label: "Date of birth", key: "dob", kind: "dob" },
    { label: "Gender", key: "gender", kind: "gender" },
  ] },
  { title: "Contact", fields: [
    { label: "Email", key: "email", inputType: "email", wide: true },
    { label: "Phone", key: "phone", inputType: "tel" },
    { label: "Parent's phone", key: "parent_phone", inputType: "tel" },
    { label: "Address", key: "address", wide: true },
  ] },
  { title: "Admission", fields: [
    { label: "Category", key: "category", kind: "category" },
    { label: "Seat category", key: "seat_category", kind: "seat" },
  ] },
];

const CATEGORY_OPTIONS = ["OC", "BC-A", "BC-B", "BC-C", "BC-D", "BC-E", "SC", "ST", "EWS"];
const SEAT_OPTIONS = ["Convenor (A-Category)", "Management (B-Category)", "NRI / Spot Admission"];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export function ProfilePage({ user, onLoggedOut }: Props) {
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentSelf | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<StudentSelf>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selfEditEnabled, setSelfEditEnabled] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await getMyProfile();
      setStudent(res.student);
      setEditData(res.student);
      setSelfEditEnabled(Boolean(res.student_self_edit_enabled));
    } catch (_err) {
      setLoadFailed(true);
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() { setEditData(student ?? {}); setEditError(null); setEditing(true); }
  function stopEdit() { setEditData(student ?? {}); setEditError(null); setEditing(false); }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!selfEditEnabled) return;
    setSubmitting(true); setEditError(null);
    try {
      const res = await updateMyProfile(editData as Parameters<typeof updateMyProfile>[0]);
      setStudent(res.student);
      setEditData(res.student);
      setEditing(false);
      setNotice("Profile updated");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update profile");
    } finally { setSubmitting(false); }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMyProfilePhoto(file);
      setStudent(prev => prev ? { ...prev, photo_path: res.photo_path } : prev);
      setNotice("Photo updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    }
    e.target.value = "";
  }

  async function handleRemovePhoto() {
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      await deleteMyProfilePhoto();
      setStudent(prev => prev ? { ...prev, photo_path: null } : prev);
      setNotice("Photo removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    setSubmitting(true);
    try {
      await changeMyProfilePassword({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw });
      setOldPw(""); setNewPw(""); setConfirmPw("");
      setShowPwForm(false);
      setNotice("Password changed");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <AppShell user={user} activeNav="profile" heading="My Profile" onLoggedOut={onLoggedOut}>
      <p className="empty-note">Loading…</p>
    </AppShell>
  );

  if (!student) return (
    <AppShell user={user} activeNav="profile" heading="My Profile" onLoggedOut={onLoggedOut}>
      <div className="pf">
        <div className="pf-card pf-row">
          <strong>{loadFailed ? "Couldn't load your profile." : "No profile found."}</strong>
          <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" onClick={() => void reload()}>Retry</button>
        </div>
      </div>
    </AppShell>
  );

  const photoSrc = formatPhotoUrl(student.photo_path);
  const record = student as unknown as Record<string, unknown>;
  const draft = editData as unknown as Record<string, unknown>;
  const canType = editing && selfEditEnabled;

  function renderInput({ label, key, kind, inputType }: FieldDef, id: string) {
    const val = String(draft[key] ?? "");
    const set = (v: string) => setEditData({ ...editData, [key]: v });
    if (kind === "gender") {
      const current = val.toUpperCase();
      return (
        <div className="pf-seg" role="group" aria-label={label}>
          {[{ t: "Male", v: "MALE" }, { t: "Female", v: "FEMALE" }].map((o) => (
            <button key={o.v} type="button" aria-pressed={current === o.v} onClick={() => set(o.v)}>{o.t}</button>
          ))}
        </div>
      );
    }
    if (kind === "category" || kind === "seat") {
      const options = kind === "category" ? CATEGORY_OPTIONS : SEAT_OPTIONS;
      return (
        <select id={id} value={val} onChange={(e) => set(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input id={id} type={kind === "dob" ? "date" : inputType || "text"} value={val} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <AppShell user={user} activeNav="profile" heading="My Profile"
      whoami={`${student.roll_no} · ${student.name}`}
      onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error || editError || pwError} onClose={() => { setError(null); setEditError(null); setPwError(null); }} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      <div className="pf">
        <form className="pf-card" onSubmit={handleSaveProfile}>
          <div className="pf-head">
            {photoSrc
              ? <img src={photoSrc} alt="" className="pf-avatar" />
              : <div className="pf-avatar is-initials" aria-hidden="true">{initials(student.name)}</div>}
            <div className="pf-id">
              <h2>{student.name}</h2>
              <p>{student.roll_no}{student.department ? ` · ${student.department}` : ""}</p>
            </div>
            {!editing && (
              <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" onClick={startEdit}>Edit</button>
            )}
          </div>

          {editing && (
            <div className="pf-photo-tools">
              <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" onClick={() => photoRef.current?.click()}>
                {photoSrc ? "Change photo" : "Add photo"}
              </button>
              {photoSrc && <button type="button" className="pf-link-danger" onClick={handleRemovePhoto}>Remove photo</button>}
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
            </div>
          )}

          {editing && !selfEditEnabled && (
            <p className="pf-lock" role="alert">
              Editing details is turned off by your college administrator. To change your name, phone numbers or other details, contact your HOD. You can still change your photo.
            </p>
          )}

          {GROUPS.map((group) => (
            <section key={group.title} className="pf-group" aria-label={group.title}>
              <h3>{group.title}</h3>
              <div className={`pf-grid${canType ? " is-editing" : ""}`}>
                {group.fields.filter((f) => canType || !f.editOnly).map((f) => {
                  const id = `pf-${String(f.key)}`;
                  const raw = String(record[f.key] ?? "").trim();
                  const value = f.kind === "gender" && raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw;
                  return (
                    <div key={String(f.key)} className={`${canType ? "pf-field" : "pf-item"}${f.wide ? " pf-wide" : ""}`}>
                      {canType
                        ? <><label className="pf-label" htmlFor={id}>{f.label}</label>{renderInput(f, id)}</>
                        : <><span className="pf-label">{f.label}</span><div className={`pf-val${value ? "" : " is-empty"}`}>{value || "Not set"}</div></>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {editing && (
            <div className="pf-actions">
              {selfEditEnabled
                ? <>
                    <button type="submit" className="ng-flat-btn ng-flat-btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</button>
                    <button type="button" className="ng-flat-btn ng-flat-btn-outline" onClick={stopEdit} disabled={submitting}>Cancel</button>
                  </>
                : <button type="button" className="ng-flat-btn ng-flat-btn-outline" onClick={stopEdit}>Done</button>}
            </div>
          )}
        </form>

        <div className="pf-card">
          <div className="pf-row">
            <strong>Password</strong>
            {!showPwForm && <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" onClick={() => setShowPwForm(true)}>Change</button>}
          </div>
          {showPwForm && (
            <form className="pf-pw" onSubmit={handleChangePassword}>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-old">Current password</label>
                <input id="pf-old" type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} required autoComplete="current-password" />
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-new">New password (min 8 characters)</label>
                <input id="pf-new" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="pf-confirm">Confirm new password</label>
                <input id="pf-confirm" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="ng-flat-btn ng-flat-btn-primary" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
                <button type="button" className="ng-flat-btn ng-flat-btn-outline" onClick={() => { setShowPwForm(false); setOldPw(""); setNewPw(""); setConfirmPw(""); }}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className="profile-logout-zone pf-logout">
          <button
            type="button"
            className="profile-logout"
            onClick={async () => {
              try { await logout(); } catch (err) { console.warn("Logout failed:", err); }
              finally { onLoggedOut(); navigate("/login"); }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>
            Log out
          </button>
        </div>
      </div>
    </AppShell>
  );
}
