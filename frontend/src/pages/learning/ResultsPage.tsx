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

  return (
    <AppShell
      user={user}
      activeNav="results"
      heading="My Results"
      whoami={`${data?.student?.name || user.username}${data?.student?.roll_no ? ` · ${data.student.roll_no}` : ""}`}
      onLoggedOut={onLoggedOut}
    >
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="empty-note">Loading results…</p>}
      {!loading && !error && data && data.results.length === 0 && (
        <div className="card card-pad empty-note">No published semester results were found for your cohort yet.</div>
      )}

      {!loading && !error && data?.student && data.results.length > 0 && (
        <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 20 }}>
          {data.results.map((semesterResult) => (
            <section
              key={semesterResult.batch.id}
              className="card card-pad"
              style={{ border: "1px solid var(--border)", boxShadow: "none" }}
            >
              <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18, marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                      NextGen · CSE Data Science
                    </div>
                    <h1 style={{ margin: 0, fontSize: 28 }}>Semester Result — {semesterResult.batch.semester_name}</h1>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>SGPA</div>
                    <div style={{ fontSize: 30, fontWeight: 900 }}>{semesterResult.sgpa ?? "—"}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(160px, auto)", gap: 16, marginTop: 18 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{data.student.name}</div>
                    <div className="subtitle-muted">Semester: {semesterResult.batch.semester_code}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="subtitle-muted">Roll No</div>
                    <div style={{ fontWeight: 800 }}>{data.student.roll_no}</div>
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Subject</th><th className="center">Internal</th><th className="center">External</th><th className="center">Total</th><th className="center">Grade</th><th className="center">GP</th></tr>
                  </thead>
                  <tbody>
                    {semesterResult.subjects.map((subject, i) => (
                      <tr key={`${subject.subject_code}-${i}`}>
                        <td><div style={{ fontWeight: 700 }}>{subject.subject_name}</div><div className="subtitle-muted" style={{ fontSize: 11 }}>{subject.subject_code}</div></td>
                        <td className="center">{subject.internal_marks ?? "—"}</td>
                        <td className="center">{subject.external_marks ?? "—"}</td>
                        <td className="center">{subject.marks}{subject.max_marks ? ` / ${subject.max_marks}` : ""}</td>
                        <td className="center">{subject.grade || "—"}</td>
                        <td className="center">{subject.grade_point || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 0", borderTop: "1px solid var(--border)", marginTop: 18, fontWeight: 800 }}>
                <div>Total Credits: {Number(semesterResult.total_credits || 0).toFixed(2).replace(/\.00$/, "")}</div>
                <div>Result: {semesterResult.result_status || "—"}</div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, color: "var(--muted)", fontSize: 11.5 }}>
                Generated from official semester result upload.
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
