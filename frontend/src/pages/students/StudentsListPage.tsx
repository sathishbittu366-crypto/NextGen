import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStudents, deleteStudent, type StudentListRow } from "../../api/students";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { AppShell } from "../../components/AppShell";
import { ToastPopup } from "../../components/ToastPopup";

interface StudentsListPageProps {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function StudentsListPage({ user, onLoggedOut }: StudentsListPageProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState(""); // "", "1", "2", "3", "4"
  const [rows, setRows] = useState<StudentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Permanent Delete Modal State
  const [studentToDelete, setStudentToDelete] = useState<StudentListRow | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteKeyInput, setDeleteKeyInput] = useState("");

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStudents(query, "All");
      setRows(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(q); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(q);
  }

  async function handleConfirmDelete() {
    if (!studentToDelete) return;
    setDeletingStudent(true);
    setError(null);
    try {
      await deleteStudent(studentToDelete.id);
      setNotice(`Student "${studentToDelete.name}" (${studentToDelete.roll_no}) permanently deleted`);
      setRows((prev) => prev.filter((r) => r.id !== studentToDelete.id));
      setStudentToDelete(null);
      load(q);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete student profile");
    } finally {
      setDeletingStudent(false);
    }
  }

  // Client-side year filter
  const YEAR_LABELS: Record<string, string> = {
    "1": "1st Year",
    "2": "2nd Year",
    "3": "3rd Year",
    "4": "4th Year",
  };
  const displayedRows = yearFilter
    ? rows.filter((r) => r.year_of_study === YEAR_LABELS[yearFilter])
    : rows;

  return (
    <AppShell user={user} activeNav="students" heading="Students" onLoggedOut={onLoggedOut}>
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap", minWidth: 0 }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, roll no, email or phone…"
            style={{ flex: 1, minWidth: 160, maxWidth: 320, height: 40, padding: "0 12px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 13 }}
          />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ height: 40, padding: "0 10px", border: "1px solid #d0d5dd", borderRadius: 6, fontSize: 13, fontWeight: 600, minWidth: 160 }}
          >
            <option value="">All Years</option>
            <option value="1">1st Year (2026-2030)</option>
            <option value="2">2nd Year (2025-2029)</option>
            <option value="3">3rd Year (2024-2028)</option>
            <option value="4">4th Year (2023-2027)</option>
          </select>
          <button type="submit" className="btn btn-outline">Search</button>
        </form>
        {["HOD", "ADMIN"].includes(user.role) && (
          <button className="btn" onClick={() => navigate("/students/new")}>+ Add Student</button>
        )}
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="table-wrap responsive-cards">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll No</th><th>Name</th><th>Year & Batch</th><th>Email</th><th>Phone</th><th>Aadhaar</th><th className="center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r) => (
              <tr key={r.id}>
                <td data-label="Roll No">{r.roll_no}</td>
                <td data-label="Name"><Link to={`/students/${r.id}`}>{r.name}</Link></td>
                <td data-label="Year & Batch">
                  <span className="chip chip-blue" style={{ fontSize: 11, padding: "2px 8px" }}>
                    {r.year_of_study || "1st Year"}
                  </span>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {r.batch || "2026-2030 Batch"}
                  </div>
                </td>
                <td data-label="Email">{r.email || ""}</td>
                <td data-label="Phone">{r.phone || ""}</td>
                <td data-label="Aadhaar">{r.aadhaar_masked}</td>
                <td data-label="Actions" className="center" style={{ whiteSpace: "nowrap" }}>
                  <Link to={`/students/${r.id}`} className="btn btn-sm btn-outline">View</Link>
                  {["HOD", "ADMIN"].includes(user.role) && (
                    <button
                      className="btn btn-sm btn-red"
                      style={{ marginLeft: 6, fontWeight: 700 }}
                      onClick={() => { setStudentToDelete(r); setDeleteKeyInput(""); }}
                      title="Permanently delete this student profile"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty-note">Loading…</p>}
        {!loading && displayedRows.length === 0 && <p className="empty-note">No students match this search.</p>}
      </div>

      {/* ── Permanent Delete Student Confirmation Modal ── */}
      {studentToDelete && (() => {
        const isKeyValid = deleteKeyInput.trim().toUpperCase() === "DELETE" ||
          deleteKeyInput.trim().toLowerCase() === studentToDelete.roll_no.toLowerCase();

        return (
          <div className="modal-overlay" onClick={() => !deletingStudent && setStudentToDelete(null)}>
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
                  👨‍🎓 {studentToDelete.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--heading-accent)", fontWeight: 700, marginTop: 3 }}>
                  Roll No: <strong>{studentToDelete.roll_no}</strong> · Batch: <strong>{studentToDelete.batch || "—"}</strong>
                </div>
                {studentToDelete.email && (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginTop: 3 }}>
                    Email: {studentToDelete.email}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, marginBottom: 16, fontWeight: 500 }}>
                Are you sure you want to permanently delete this student record?
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 12.5, color: "#b91c1c", fontWeight: 600 }}>
                  <li>Student account, credentials, and attendance records will be permanently removed.</li>
                  <li>This student will no longer appear anywhere in the application.</li>
                </ul>
              </div>

              {/* 🔑 Security Confirmation Key Input */}
              <div style={{ marginBottom: 20, background: "rgba(239, 68, 68, 0.06)", padding: 14, borderRadius: 12, border: "1.5px dashed #fca5a5" }}>
                <label htmlFor="confirm-list-delete-key" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#991b1b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🔑 Enter Confirmation Key To Authorize:
                </label>
                <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 8, fontWeight: 600 }}>
                  Type <strong style={{ color: "#dc2626" }}>DELETE</strong> or <strong style={{ color: "#2563eb" }}>{studentToDelete.roll_no}</strong> below:
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="confirm-list-delete-key"
                    type="text"
                    placeholder={`Type "DELETE" or "${studentToDelete.roll_no}"`}
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
                    onClick={() => setDeleteKeyInput(studentToDelete.roll_no)}
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
                  onClick={() => setStudentToDelete(null)}
                  disabled={deletingStudent}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={handleConfirmDelete}
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
