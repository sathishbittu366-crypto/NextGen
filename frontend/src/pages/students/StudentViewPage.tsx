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

  // Permanent Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteKeyInput, setDeleteKeyInput] = useState("");

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

  async function handleConfirmDeleteStudent() {
    if (!detail) return;
    setDeletingStudent(true);
    setError(null);
    try {
      await deleteStudent(id);
      navigate("/students");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete student profile");
    } finally {
      setDeletingStudent(false);
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
            className="btn btn-red"
            style={{ fontWeight: 800 }}
            onClick={() => { setShowDeleteModal(true); setDeleteKeyInput(""); }}
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

      {/* ── Permanent Delete Student Confirmation Modal ── */}
      {showDeleteModal && detail && (() => {
        const isKeyValid = deleteKeyInput.trim().toUpperCase() === "DELETE" ||
          deleteKeyInput.trim().toLowerCase() === detail.student.roll_no.toLowerCase();

        return (
          <div className="modal-overlay" onClick={() => !deletingStudent && setShowDeleteModal(false)}>
            <div
              className="modal-box modal3dPopIn"
              style={{
                maxWidth: 490,
                width: "92%",
                background: "var(--bg-card)",
                border: "1.5px solid #fca5a5",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(220, 38, 38, 0.28)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                  border: "1px solid #fca5a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "#dc2626",
                  flexShrink: 0
                }}>
                  ⚠️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: "#991b1b", fontWeight: 800 }}>
                    Permanent Delete Student Profile
                  </h3>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
                    This action will permanently erase this student from the system.
                  </div>
                </div>
              </div>

              <div style={{
                background: "var(--row-alt)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                  👨‍🎓 {detail.student.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--heading-accent)", fontWeight: 700, marginTop: 3 }}>
                  Roll No: <strong>{detail.student.roll_no}</strong> · Batch: <strong>{detail.student.batch || "—"}</strong>
                </div>
                {detail.student.email && (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginTop: 3 }}>
                    Email: {detail.student.email}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, marginBottom: 16, fontWeight: 500 }}>
                Are you sure you want to permanently delete this student record?
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 12.5, color: "#b91c1c", fontWeight: 600 }}>
                  <li>Student account, login credentials, and attendance records will be removed.</li>
                  <li>This student will no longer appear anywhere in the application.</li>
                </ul>
              </div>

              {/* 🔑 Security Confirmation Key Input */}
              <div style={{ marginBottom: 20, background: "rgba(239, 68, 68, 0.06)", padding: 14, borderRadius: 12, border: "1.5px dashed #fca5a5" }}>
                <label htmlFor="confirm-student-delete-key" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#991b1b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🔑 Enter Confirmation Key To Authorize:
                </label>
                <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 8, fontWeight: 600 }}>
                  Type <strong style={{ color: "#dc2626" }}>DELETE</strong> or <strong style={{ color: "#2563eb" }}>{detail.student.roll_no}</strong> below:
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="confirm-student-delete-key"
                    type="text"
                    placeholder={`Type "DELETE" or "${detail.student.roll_no}"`}
                    value={deleteKeyInput}
                    onChange={(e) => setDeleteKeyInput(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      height: 40,
                      padding: "0 12px",
                      borderRadius: 8,
                      border: isKeyValid ? "2px solid #10b981" : "1.5px solid var(--border)",
                      background: "#ffffff",
                      color: "var(--text)",
                      fontWeight: 700,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setDeleteKeyInput(detail.student.roll_no)}
                    title="Insert roll number key"
                    style={{ fontSize: 12, whiteSpace: "nowrap", fontWeight: 700 }}
                  >
                    🔑 Fill Key
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingStudent}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={handleConfirmDeleteStudent}
                  disabled={deletingStudent || !isKeyValid}
                  style={{
                    minWidth: 160,
                    fontWeight: 800,
                    opacity: isKeyValid ? 1 : 0.5,
                    cursor: isKeyValid ? "pointer" : "not-allowed"
                  }}
                >
                  {deletingStudent ? "Deleting…" : "🗑️ Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
