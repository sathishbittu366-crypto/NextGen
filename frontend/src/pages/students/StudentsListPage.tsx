// Group 4 — Students list. Mirrors webapp/routes/students.py's
// students_list() + templates/students/list.html.
// STUDENT role never reaches this page — App.tsx redirects it to
// /me/profile before render, same as the OG route's own redirect.
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStudents, deleteStudent, type StudentListRow } from "../../api/students";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { AppShell } from "../../components/AppShell";

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

  async function handleDelete(r: StudentListRow) {
    if (!window.confirm(`Are you sure you want to delete profile for ${r.name} (${r.roll_no})? This action cannot be undone.`)) return;
    try {
      await deleteStudent(r.id);
      load(q);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete student profile");
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
                      className="btn btn-sm btn-warn"
                      style={{ marginLeft: 6 }}
                      onClick={() => handleDelete(r)}
                    >
                      Delete
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
    </AppShell>
  );
}
