import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  listStudents,
  listStudentSemesters,
  deleteStudent,
  type StudentListRow,
  type SemesterOption,
} from "../../api/students";
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
  const [semesterFilter, setSemesterFilter] = useState(""); // "", "1", "2", ...
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [rows, setRows] = useState<StudentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Permanent Delete Modal State
  const [studentToDelete, setStudentToDelete] = useState<StudentListRow | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteKeyInput, setDeleteKeyInput] = useState("");

  // Print Modal State (HOD & ADMIN ONLY)
  const canPrint = ["HOD", "ADMIN"].includes(user.role);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTitle, setPrintTitle] = useState("STUDENT NOMINAL ROLL / ROSTER");
  const [printSemesterId, setPrintSemesterId] = useState<string>("");
  const [includeColumns, setIncludeColumns] = useState({
    gender: true,
    phone: true,
    parentPhone: true,
    email: true,
    signature: true,
  });

  // Load semesters
  useEffect(() => {
    listStudentSemesters()
      .then((res) => setSemesters(res))
      .catch(() => {
        // Fallback default semesters if endpoint unavailable
        setSemesters([
          { id: 1, code: "I-I", name: "I Year - I Semester" },
          { id: 2, code: "I-II", name: "I Year - II Semester" },
          { id: 3, code: "II-I", name: "II Year - I Semester" },
          { id: 4, code: "II-II", name: "II Year - II Semester" },
          { id: 5, code: "III-I", name: "III Year - I Semester" },
          { id: 6, code: "III-II", name: "III Year - II Semester" },
          { id: 7, code: "IV-I", name: "IV Year - I Semester" },
          { id: 8, code: "IV-II", name: "IV Year - II Semester" },
        ]);
      });
  }, []);

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

  useEffect(() => {
    load(q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Client-side year & semester filtering
  const YEAR_LABELS: Record<string, string> = {
    "1": "1st Year",
    "2": "2nd Year",
    "3": "3rd Year",
    "4": "4th Year",
  };

  // Filtered and sorted strictly in natural ascending Roll Number order
  const displayedRows = useMemo(() => {
    let list = rows;

    if (yearFilter) {
      list = list.filter((r) => r.year_of_study === YEAR_LABELS[yearFilter]);
    }

    if (semesterFilter) {
      const semId = Number(semesterFilter);
      list = list.filter((r) => r.current_semester_id === semId);
    }

    return [...list].sort((a, b) =>
      a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [rows, yearFilter, semesterFilter]);

  // Rows for printable nominal roll
  const printableRows = useMemo(() => {
    let list = rows;
    if (printSemesterId) {
      const semId = Number(printSemesterId);
      list = list.filter((r) => r.current_semester_id === semId);
    } else if (semesterFilter) {
      const semId = Number(semesterFilter);
      list = list.filter((r) => r.current_semester_id === semId);
    } else if (yearFilter) {
      list = list.filter((r) => r.year_of_study === YEAR_LABELS[yearFilter]);
    }
    return [...list].sort((a, b) =>
      a.roll_no.localeCompare(b.roll_no, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [rows, printSemesterId, semesterFilter, yearFilter]);

  const activePrintSemesterObj = semesters.find(
    (s) => s.id === Number(printSemesterId || semesterFilter)
  );

  const formattedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <AppShell user={user} activeNav="students" heading="Students" onLoggedOut={onLoggedOut}>
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      {/* ── Toolbar & Filters ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
          background: "var(--bg-card)",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap", minWidth: 0 }}
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by roll no, name, phone, email…"
            style={{
              flex: 1,
              minWidth: 200,
              maxWidth: 320,
              height: 40,
              padding: "0 12px",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 500,
            }}
          />

          {/* Semester Filter */}
          <select
            value={semesterFilter}
            onChange={(e) => {
              setSemesterFilter(e.target.value);
              setPrintSemesterId(e.target.value);
            }}
            style={{
              height: 40,
              padding: "0 12px",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              minWidth: 170,
              background: "var(--input-bg)",
              color: "var(--text)",
            }}
          >
            <option value="">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} ({s.name})
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{
              height: 40,
              padding: "0 10px",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              minWidth: 150,
              background: "var(--input-bg)",
              color: "var(--text)",
            }}
          >
            <option value="">All Years</option>
            <option value="1">1st Year (2026-2030)</option>
            <option value="2">2nd Year (2025-2029)</option>
            <option value="3">3rd Year (2024-2028)</option>
            <option value="4">4th Year (2023-2027)</option>
          </select>

          <button type="submit" className="btn btn-outline" style={{ height: 40, fontWeight: 700 }}>
            🔍 Search
          </button>
        </form>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Print Option — ONLY FOR HOD AND ADMIN */}
          {canPrint && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setPrintSemesterId(semesterFilter);
                setShowPrintModal(true);
              }}
              style={{
                height: 40,
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderColor: "var(--nav2)",
                color: "var(--nav2)",
                fontWeight: 700,
                padding: "0 14px",
                borderRadius: 8,
              }}
              title="Print official student list / nominal roll for this semester"
            >
              🖨️ Print Student List
            </button>
          )}

          {["HOD", "ADMIN"].includes(user.role) && (
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/students/new")}
              style={{ height: 40, fontWeight: 700, borderRadius: 8 }}
            >
              + Add Student
            </button>
          )}
        </div>
      </div>

      {error && <div className="login-error no-print">{error}</div>}

      {/* ── Summary Badge ── */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          padding: "0 4px",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Showing <span style={{ color: "var(--blue)" }}>{displayedRows.length}</span> students{" "}
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--subtext)" }}>
            (Sorted in Roll Number Order)
          </span>
          {semesterFilter && activePrintSemesterObj && (
            <span
              className="chip chip-blue"
              style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px" }}
            >
              Semester: {activePrintSemesterObj.code}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Students Table (Roll Number Wise) ── */}
      <div className="table-wrap responsive-cards no-print">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60, textAlign: "center" }}>S.No</th>
              <th>Roll No</th>
              <th>Name</th>
              <th>Year & Batch</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Aadhaar</th>
              <th className="center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, index) => (
              <tr key={r.id}>
                <td data-label="S.No" style={{ textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>
                  {index + 1}
                </td>
                <td data-label="Roll No" style={{ fontWeight: 800, color: "var(--blue)", letterSpacing: "0.5px" }}>
                  {r.roll_no.toUpperCase()}
                </td>
                <td data-label="Name" style={{ fontWeight: 700 }}>
                  <Link to={`/students/${r.id}`} style={{ color: "var(--text)" }}>
                    {r.name}
                  </Link>
                </td>
                <td data-label="Year & Batch">
                  <span className="chip chip-blue" style={{ fontSize: 11, padding: "2px 8px" }}>
                    {r.year_of_study || "1st Year"}
                  </span>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {r.batch || "2026-2030 Batch"}
                  </div>
                </td>
                <td data-label="Email">{r.email || "—"}</td>
                <td data-label="Phone">{r.phone || "—"}</td>
                <td data-label="Aadhaar">{r.aadhaar_masked || "—"}</td>
                <td data-label="Actions" className="center" style={{ whiteSpace: "nowrap" }}>
                  <Link to={`/students/${r.id}`} className="btn btn-sm btn-outline">
                    View
                  </Link>
                  {["HOD", "ADMIN"].includes(user.role) && (
                    <button
                      className="btn btn-sm btn-red"
                      style={{ marginLeft: 6, fontWeight: 700 }}
                      onClick={() => {
                        setStudentToDelete(r);
                        setDeleteKeyInput("");
                      }}
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
        {loading && <p className="empty-note">Loading students list…</p>}
        {!loading && displayedRows.length === 0 && (
          <p className="empty-note">No students match this search or semester filter.</p>
        )}
      </div>

      {/* ── Official Print Modal & Nominal Roll Sheet (HOD & ADMIN ONLY) ── */}
      {showPrintModal && canPrint && (
        <div className="modal-overlay print-active-modal" onClick={() => setShowPrintModal(false)}>
          <div
            className="modal-box modal3dPopIn"
            style={{
              maxWidth: 960,
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--bg-card)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Controls (Hidden in Print) */}
            <div
              className="print-controls no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 14,
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--heading-dark)" }}>
                  🖨️ Official Semester Student List / Nominal Roll
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
                  Configured exclusively for Head of Department and Administrators
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPrintModal(false)}
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => window.print()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 800,
                    background: "var(--blue)",
                    color: "#ffffff",
                    padding: "0 18px",
                  }}
                >
                  🖨️ Print Now / Save PDF
                </button>
              </div>
            </div>

            {/* Customization Bar (Hidden in Print) */}
            <div
              className="print-controls no-print"
              style={{
                background: "var(--row-alt)",
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--border)",
                marginBottom: 20,
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                  DOCUMENT TITLE
                </label>
                <select
                  value={printTitle}
                  onChange={(e) => setPrintTitle(e.target.value)}
                  style={{
                    width: "100%",
                    height: 36,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <option value="STUDENT NOMINAL ROLL / ROSTER">STUDENT NOMINAL ROLL / ROSTER</option>
                  <option value="SEMESTER ATTENDANCE REGISTER">SEMESTER ATTENDANCE REGISTER</option>
                  <option value="INTERNAL ASSESSMENT / EXAM ATTENDANCE ROSTER">INTERNAL ASSESSMENT / EXAM ATTENDANCE ROSTER</option>
                  <option value="LABORATORY PRACTICAL ATTENDANCE ROSTER">LABORATORY PRACTICAL ATTENDANCE ROSTER</option>
                  <option value="STUDENT & PARENT CONTACT DIRECTORY">STUDENT & PARENT CONTACT DIRECTORY</option>
                </select>
              </div>

              <div style={{ minWidth: 180 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                  SELECT SEMESTER
                </label>
                <select
                  value={printSemesterId}
                  onChange={(e) => setPrintSemesterId(e.target.value)}
                  style={{
                    width: "100%",
                    height: 36,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <option value="">All Semesters</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} ({s.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
                  INCLUDE COLUMNS
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, fontWeight: 600 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeColumns.gender}
                      onChange={(e) => setIncludeColumns((p) => ({ ...p, gender: e.target.checked }))}
                    />
                    Gender
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeColumns.phone}
                      onChange={(e) => setIncludeColumns((p) => ({ ...p, phone: e.target.checked }))}
                    />
                    Phone
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeColumns.parentPhone}
                      onChange={(e) => setIncludeColumns((p) => ({ ...p, parentPhone: e.target.checked }))}
                    />
                    Parent Phone
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeColumns.email}
                      onChange={(e) => setIncludeColumns((p) => ({ ...p, email: e.target.checked }))}
                    />
                    Email
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeColumns.signature}
                      onChange={(e) => setIncludeColumns((p) => ({ ...p, signature: e.target.checked }))}
                    />
                    Signature / Remarks
                  </label>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                PRINTABLE DOCUMENT SECTION (RENDERED BOTH ON SCREEN AND PRINTER)
                ══════════════════════════════════════════════════════════════════ */}
            <div
              className="printable-document"
              style={{
                background: "#ffffff",
                color: "#000000",
                padding: "16px 20px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            >
              {/* Institution Header */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #000000", paddingBottom: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.5px", textTransform: "uppercase", color: "#0f172a" }}>
                  Vignana Bharathi Institute of Technology
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
                  Department of Computer Science and Design (CSD)
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    textDecoration: "underline",
                    textTransform: "uppercase",
                    marginTop: 8,
                    color: "#000000",
                  }}
                >
                  {printTitle}
                </div>
              </div>

              {/* Document Metadata Table */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 6,
                  borderBottom: "1px solid #94a3b8",
                  paddingBottom: 6,
                }}
              >
                <div>
                  <strong>Semester:</strong>{" "}
                  {activePrintSemesterObj ? `${activePrintSemesterObj.code} (${activePrintSemesterObj.name})` : "All Semesters"}
                </div>
                <div>
                  <strong>Academic Year:</strong> 2026 - 2027
                </div>
                <div>
                  <strong>Date:</strong> {formattedDate}
                </div>
                <div>
                  <strong>Total Strength:</strong>{" "}
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{printableRows.length} Students</span>
                </div>
              </div>

              {/* Printable Table */}
              <table className="printable-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ width: 45, textAlign: "center" }}>S.No</th>
                    <th style={{ width: 130 }}>Roll Number</th>
                    <th>Student Name</th>
                    {includeColumns.gender && <th style={{ width: 65, textAlign: "center" }}>Gender</th>}
                    {includeColumns.phone && <th style={{ width: 105 }}>Phone</th>}
                    {includeColumns.parentPhone && <th style={{ width: 105 }}>Parent Phone</th>}
                    {includeColumns.email && <th>Email</th>}
                    {includeColumns.signature && <th style={{ width: 130, textAlign: "center" }}>Signature / Remarks</th>}
                  </tr>
                </thead>
                <tbody>
                  {printableRows.map((r, index) => (
                    <tr key={r.id}>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{index + 1}</td>
                      <td style={{ fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                        {r.roll_no.toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      {includeColumns.gender && (
                        <td style={{ textAlign: "center", textTransform: "capitalize" }}>
                          {r.gender ? r.gender.charAt(0).toUpperCase() : "—"}
                        </td>
                      )}
                      {includeColumns.phone && <td>{r.phone || "—"}</td>}
                      {includeColumns.parentPhone && <td>{r.parent_phone || "—"}</td>}
                      {includeColumns.email && <td style={{ fontSize: 11 }}>{r.email || "—"}</td>}
                      {includeColumns.signature && (
                        <td style={{ height: 28, border: "1px solid #333333" }}></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {printableRows.length === 0 && (
                <div style={{ textAlign: "center", padding: 24, fontStyle: "italic", color: "#64748b" }}>
                  No student records found for the selected semester.
                </div>
              )}

              {/* Official Signatures Grid */}
              <div className="print-signatures" style={{ marginTop: 40, display: "flex", justifyContent: "space-between" }}>
                <div className="print-sig-block" style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ borderTop: "1px dashed #475569", paddingTop: 4, fontWeight: 700, fontSize: 11 }}>
                    Class Incharge
                  </div>
                </div>
                <div className="print-sig-block" style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ borderTop: "1px dashed #475569", paddingTop: 4, fontWeight: 700, fontSize: 11 }}>
                    Academic Coordinator
                  </div>
                </div>
                <div className="print-sig-block" style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ borderTop: "1px dashed #475569", paddingTop: 4, fontWeight: 700, fontSize: 11 }}>
                    Head of Department (CSD)
                  </div>
                </div>
                <div className="print-sig-block" style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ borderTop: "1px dashed #475569", paddingTop: 4, fontWeight: 700, fontSize: 11 }}>
                    Principal
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Delete Student Confirmation Modal ── */}
      {studentToDelete && (() => {
        const isKeyValid =
          deleteKeyInput.trim().toUpperCase() === "DELETE" ||
          deleteKeyInput.trim().toLowerCase() === studentToDelete.roll_no.toLowerCase();

        return (
          <div className="modal-overlay no-print" onClick={() => !deletingStudent && setStudentToDelete(null)}>
            <div
              className="modal-box modal3dPopIn"
              style={{
                maxWidth: 490,
                width: "92%",
                background: "var(--bg-card)",
                border: "1.5px solid #fca5a5",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(220, 38, 38, 0.28)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div
                  style={{
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
                    flexShrink: 0,
                  }}
                >
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

              <div
                style={{
                  background: "var(--row-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                  👨‍🎓 {studentToDelete.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--heading-accent)", fontWeight: 700, marginTop: 3 }}>
                  Roll No: <strong>{studentToDelete.roll_no}</strong> · Batch:{" "}
                  <strong>{studentToDelete.batch || "—"}</strong>
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

              {/* Security Confirmation Key Input */}
              <div
                style={{
                  marginBottom: 20,
                  background: "rgba(239, 68, 68, 0.06)",
                  padding: 14,
                  borderRadius: 12,
                  border: "1.5px dashed #fca5a5",
                }}
              >
                <label
                  htmlFor="confirm-list-delete-key"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#991b1b",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  🔑 Enter Confirmation Key To Authorize:
                </label>
                <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 8, fontWeight: 600 }}>
                  Type <strong style={{ color: "#dc2626" }}>DELETE</strong> or{" "}
                  <strong style={{ color: "#2563eb" }}>{studentToDelete.roll_no}</strong> below:
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
                      outline: "none",
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
                    cursor: isKeyValid ? "pointer" : "not-allowed",
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
