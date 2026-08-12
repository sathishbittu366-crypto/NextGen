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

type StatusFilter = "Active" | "Inactive" | "All";

export function StudentsListPage({ user, onLoggedOut }: StudentsListPageProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("Active");
  const [rows, setRows] = useState<StudentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string, statusVal: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStudents(query, statusVal);
      setRows(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(q, status); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(q, status);
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as StatusFilter;
    setStatus(val);
    load(q, val);
  }

  async function handleDelete(r: StudentListRow) {
    if (!window.confirm(`Are you sure you want to delete profile for ${r.name} (${r.roll_no})? This action cannot be undone.`)) return;
    try {
      await deleteStudent(r.id);
      load(q, status);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete student profile");
    }
  }

  return (
    <AppShell user={user} activeNav="students" heading="Students" onLoggedOut={onLoggedOut}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search CSD Data Science student by name, roll no, email or phone..."
            style={{ flex: 1, minWidth: 220, height: 40, padding: "0 12px", border: "1px solid #d0d5dd", borderRadius: 6 }}
          />
          <select
            value={status}
            onChange={handleStatusChange}
            style={{ height: 40, border: "1px solid #d0d5dd", borderRadius: 6 }}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="All">All</option>
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
            {rows.map((r) => (
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
        {!loading && rows.length === 0 && <p className="empty-note">No students match this search.</p>}
      </div>
    </AppShell>
  );
}
