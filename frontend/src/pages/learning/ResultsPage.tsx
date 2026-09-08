import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getMyResults, type StudentResults } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

export function ResultsPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<StudentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try { setData(await getMyResults()); }
      catch (err) { setError(err instanceof ApiClientError ? err.message : "Failed to load results"); }
      finally { setLoading(false); }
    })();
  }, []);

  const summary = (() => {
    if (!data?.subjects.length) return null;
    const pcts = data.subjects.map(s => Number(s.percentage)).filter(Number.isFinite);
    const pct = pcts.length ? pcts[0] : (() => {
      const total = data.subjects.reduce((n, s) => n + Number(s.max_marks || 0), 0);
      const got = data.subjects.reduce((n, s) => n + Number(s.marks || 0), 0);
      return total ? got * 100 / total : null;
    })();
    const sgpas = data.subjects.map(s => Number(s.sgpa)).filter(Number.isFinite);
    const sgpa = sgpas.length ? sgpas[0] : null;
    const status = data.subjects.map(s => s.result_status).find(Boolean);
    return { pct, sgpa, status };
  })();

  return (
    <AppShell user={user} activeNav="results" heading="My Results" whoami={`${data?.student?.name || user.username}${data?.student?.roll_no ? ` · ${data.student.roll_no}` : ""}`} onLoggedOut={onLoggedOut}>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="empty-note">Loading results…</p>}
      {!loading && !error && !data?.batch && <div className="card card-pad empty-note">No results have been published for your current semester yet.</div>}
      {!loading && !error && data?.batch && (
        <>
          <div className="stat-row-3d" style={{ marginBottom: 20 }}>
            <div className="stat-card-3d"><div className="stat-icon-3d">🏫</div><div className="stat-info-3d"><div className="stat-title">Semester</div><div className="stat-value" style={{ fontSize: 22 }}>{data.batch.semester_code}</div></div></div>
            <div className="stat-card-3d"><div className="stat-icon-3d">📈</div><div className="stat-info-3d"><div className="stat-title">Percentage</div><div className="stat-value" style={{ fontSize: 22 }}>{summary?.pct != null ? `${summary.pct.toFixed(2)}%` : "—"}</div></div></div>
            <div className="stat-card-3d"><div className="stat-icon-3d">⭐</div><div className="stat-info-3d"><div className="stat-title">SGPA</div><div className="stat-value" style={{ fontSize: 22 }}>{summary?.sgpa != null ? summary.sgpa.toFixed(2) : "—"}</div></div></div>
          </div>

          <div className="section-head" style={{ marginBottom: 14 }}><div><h2 style={{ marginBottom: 4 }}>{data.batch.title}</h2><p className="subtitle-muted" style={{ margin: 0 }}>{data.batch.semester_name} · {data.subjects.length} subjects{summary?.status ? ` · ${summary.status}` : ""}</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Code</th><th className="center">Marks</th><th className="center">Grade</th><th className="center">Grade Point</th></tr></thead>
              <tbody>{data.subjects.map((s, i) => <tr key={`${s.subject_code}-${i}`}><td>{s.subject_name}</td><td>{s.subject_code}</td><td className="center">{s.marks} / {s.max_marks}</td><td className="center">{s.grade || "—"}</td><td className="center">{s.grade_point || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
