// Group 4 — Student detail view. Mirrors webapp/routes/students.py's
// student_view() + templates/students/view.html. HOD sees the full
// (decrypted) Aadhaar number here — same "HOD full-number view" the OG
// template's comment calls out; this is the one screen that's allowed to.
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getStudent, toggleStudentStatus, uploadStudentPhoto, deleteStudentPhoto, deleteStudent,
  EDUCATION_SPECS, type StudentDetail,
} from "../../api/students";
import { ApiClientError, formatPhotoUrl } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";

interface StudentViewPageProps {
  user: CurrentUser;
  onLoggedOut: () => void;
}

const EDU_ROWS: Array<[label: string, school: string, year: string, marks: string]> = [
  ["10th", "tenth_school", "tenth_year", "tenth_marks"],
  ["12th / Junior College", "twelfth_school", "twelfth_year", "twelfth_marks"],
  ["Diploma (if applicable)", "diploma_college", "diploma_year", "diploma_marks"],
];
void EDUCATION_SPECS;

export function StudentViewPage({ user, onLoggedOut }: StudentViewPageProps) {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const id = Number(studentId);

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudent(id);
      setDetail(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load student");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleStatus() {
    if (!detail) return;
    try {
      await toggleStudentStatus(id);
      setNotice(`${detail.student.name} ${detail.student.active ? "deactivated" : "activated"}`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update status");
    }
  }

  async function handleDeleteStudent() {
    if (!detail) return;
    if (!window.confirm(`Are you sure you want to permanently delete profile for ${detail.student.name} (${detail.student.roll_no})? This action cannot be undone.`)) return;
    try {
      await deleteStudent(id);
      navigate("/students");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete student profile");
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setError(null);
    try {
      await uploadStudentPhoto(id, file);
      setNotice("Photo updated");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Photo upload failed");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    if (!window.confirm("Remove profile photo and revert to default avatar?")) return;
    setPhotoUploading(true);
    setError(null);
    try {
      await deleteStudentPhoto(id);
      setNotice("Photo removed");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to remove photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  if (loading) {
    return (
      <AppShell user={user} activeNav="students" heading="Student" onLoggedOut={onLoggedOut}>
        <div className="empty-note">Loading…</div>
      </AppShell>
    );
  }

  if (error && !detail) {
    return (
      <AppShell user={user} activeNav="students" heading="Student" onLoggedOut={onLoggedOut}>
        <ErrorPopup message={error} onClose={() => setError(null)} />
      </AppShell>
    );
  }

  if (!detail) return null;
  const r = detail.student;
  const photoSrc = formatPhotoUrl(r.photo_path);

  return (
    <AppShell user={user} activeNav="students" heading={r.name} onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      <div className="card card-pad" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          {photoSrc ? (
            <img src={photoSrc} alt={r.name} style={{ width: 96, height: 96, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 60 }}>&#128100;</div>
          )}
          {["HOD", "ADMIN"].includes(user.role) && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={photoUploading}
                style={{ fontSize: 12, maxWidth: 180 }}
              />
              {r.photo_path && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ color: "var(--red)", borderColor: "var(--red)", fontSize: 11, padding: "2px 8px" }}
                  onClick={handleRemovePhoto}
                  disabled={photoUploading}
                >
                  Remove Photo
                </button>
              )}
              {photoUploading && <div style={{ fontSize: 12, color: "var(--muted)" }}>Processing…</div>}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{r.name}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{r.roll_no}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{r.department}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{r.email || "—"}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{r.phone || "—"}</div>
          <div style={{ marginTop: 10 }}>
            <span className={`chip ${r.active ? "chip-green" : "chip-muted"}`}>{r.active ? "Active" : "Inactive"}</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <Field label="Father Name" value={r.father_name} />
          <Field label="Parent Phone Number" value={r.parent_phone} />
          <Field label="Date of Birth" value={r.dob} />
          <Field label="Category / Gender" value={`${r.category || "—"} / ${r.gender || "—"}`} />
          <Field label="Seat Category" value={r.seat_category} />
          <Field label="Current Semester" value={detail.semester ? `${detail.semester.code} · ${detail.semester.name}` : "—"} />
          <Field label="Address" value={r.address} last />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <Field label="APAAR ID" value={r.apaar_id} />
          <Field label="Aadhaar Number (full — HOD view only)" value={r.aadhaar_number} last />
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Education Details</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Institution</th>
                <th>Year</th>
                <th>Marks (%)</th>
              </tr>
            </thead>
            <tbody>
              {EDU_ROWS.map(([label, schoolKey, yearKey, marksKey]) => (
                <tr key={label}>
                  <td><strong>{label}</strong></td>
                  <td>{(r as unknown as Record<string, string>)[schoolKey] || "—"}</td>
                  <td>{(r as unknown as Record<string, string>)[yearKey] || "—"}</td>
                  <td>{(r as unknown as Record<string, string>)[marksKey] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {["HOD", "ADMIN"].includes(user.role) && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate(`/students/${id}/edit`)}
          >
            Edit Student
          </button>
          <button
            className={`btn ${r.active ? "btn-warn" : "btn-green"}`}
            onClick={handleToggleStatus}
          >
            {r.active ? "Deactivate Student" : "Activate Student"}
          </button>
          <button
            className="btn btn-warn"
            onClick={handleDeleteStudent}
          >
            🗑️ Delete Profile
          </button>
          <button
            className="btn btn-outline"
            onClick={() => window.print()}
          >
            🖨️ Print Profile
          </button>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, value, last }: { label: string; value: string | null | undefined; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text)" }}>{value || "—"}</div>
    </div>
  );
}
