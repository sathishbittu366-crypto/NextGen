import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getMyResults, type StudentResults, type StudentSemesterResult } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

export function ResultsPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<StudentResults | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const results = await getMyResults();
        setData(results);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedResult = data?.results.find((item) => item.batch.id === selectedResultId) ?? null;

  const renderResultDetail = (semesterResult: StudentSemesterResult) => (
    <div className="results-detail-shell">
      <button
        type="button"
        className="results-back-btn"
        onClick={() => setSelectedResultId(null)}
        aria-label="Back to semester selection"
      >
        <span aria-hidden="true">←</span>
        Back to semesters
      </button>

      <section className="results-detail-card card card-pad">
        <div className="results-detail-heading">
          <div className="results-detail-kicker">NextGen · {data?.student?.department || "Student Portal"}</div>
          <div className="results-detail-title-row">
            <div className="results-detail-title-block">
              <h2>Semester Result — {semesterResult.batch.semester_name}</h2>
              <p>{data?.student?.name || user.username}</p>
              <span>Semester: {semesterResult.batch.semester_code}</span>
            </div>
            <div className="results-sgpa-block">
              <span>SGPA</span>
              <strong>{semesterResult.sgpa ?? "—"}</strong>
            </div>
          </div>
        </div>

        <div className="results-roll-chip">
          <span>Roll No</span>
          <strong>{data?.student?.roll_no || "—"}</strong>
        </div>

        <div className="results-subject-table table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="center">Internal</th>
                <th className="center">External</th>
                <th className="center">Total</th>
                <th className="center">Grade</th>
                <th className="center">GP</th>
              </tr>
            </thead>
            <tbody>
              {semesterResult.subjects.map((subject, i) => (
                <tr key={`${subject.subject_code}-${i}`}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{subject.subject_name}</div>
                    <div className="subtitle-muted" style={{ fontSize: 11 }}>{subject.subject_code}</div>
                  </td>
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

        <div className="results-subject-cards" aria-label="Subjects">
          {semesterResult.subjects.map((subject, i) => (
            <article className="results-subject-card" key={`${subject.subject_code}-${i}`}>
              <div className="results-subject-card-main">
                <div className="results-subject-name">{subject.subject_name}</div>
                <div className="results-subject-code">{subject.subject_code}</div>
              </div>
              <div className="results-mark-grid">
                <div><span>Internal</span><strong>{subject.internal_marks ?? "—"}</strong></div>
                <div><span>External</span><strong>{subject.external_marks ?? "—"}</strong></div>
                <div><span>Total</span><strong>{subject.marks}{subject.max_marks ? `/${subject.max_marks}` : ""}</strong></div>
                <div><span>Grade</span><strong>{subject.grade || "—"}</strong></div>
                <div><span>GP</span><strong>{subject.grade_point || "—"}</strong></div>
              </div>
            </article>
          ))}
        </div>

        <div className="results-summary-row">
          <div><span>Total Credits</span><strong>{Number(semesterResult.total_credits || 0).toFixed(2).replace(/\.00$/, "")}</strong></div>
          <div><span>Result</span><strong>{semesterResult.result_status || "—"}</strong></div>
        </div>
        <div className="results-generated-note">Generated from official semester result upload.</div>
      </section>
    </div>
  );

  return (
    <AppShell
      user={user}
      activeNav="results"
      heading="My Results"
      whoami={`${data?.student?.name || user.username}${data?.student?.roll_no ? ` · ${data.student.roll_no}` : ""}`}
      onLoggedOut={onLoggedOut}
    >
      <div className="results-page-shell">
        {error && <div className="error-banner">{error}</div>}
        {loading && <p className="empty-note">Loading results…</p>}
        {!loading && !error && data && data.results.length === 0 && (
          <div className="card card-pad empty-note">No published semester results were found for your cohort yet.</div>
        )}

        {!loading && !error && data?.student && data.results.length > 0 && !selectedResult && (
          <section className="results-selector-shell">
            <div className="results-selector-intro">
              <div>
                <div className="results-selector-kicker">Academic record</div>
                <h2>Select a semester</h2>
                <p>Choose a semester to view the complete marks, grades and SGPA.</p>
              </div>
              <div className="results-student-chip">
                <strong>{data.student.name}</strong>
                <span>{data.student.roll_no}</span>
              </div>
            </div>

            <div className="results-semester-grid">
              {data.results.map((semesterResult) => (
                <button
                  type="button"
                  key={semesterResult.batch.id}
                  className="results-semester-card"
                  onClick={() => setSelectedResultId(semesterResult.batch.id)}
                >
                  <div className="results-semester-card-top">
                    <span className="results-semester-year">{semesterResult.batch.semester_code}</span>
                    <span className="results-semester-arrow" aria-hidden="true">→</span>
                  </div>
                  <div className="results-semester-name">{semesterResult.batch.semester_name}</div>
                  <div className="results-semester-card-bottom">
                    <span>SGPA</span>
                    <strong>{semesterResult.sgpa ?? "—"}</strong>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && data?.student && selectedResult && renderResultDetail(selectedResult)}
      </div>
    </AppShell>
  );
}
