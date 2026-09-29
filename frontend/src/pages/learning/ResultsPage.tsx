import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getMyResults, type StudentResults, type StudentSemesterResult } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

function programmeLabel(department: string | null | undefined): string {
  const normalized = String(department || "").trim().toUpperCase();
  if (normalized === "CSD") return "B.Tech CSE (Data Science)";
  return department?.trim() || "B.Tech CSE (Data Science)";
}

function semesterContext(semesterName: string | null | undefined, semesterCode: string | null | undefined): string {
  const name = String(semesterName || "").trim();
  if (name) return name.toUpperCase().replace(/\s*-\s*/g, " · ");
  return String(semesterCode || "SEMESTER").trim().toUpperCase();
}

function isFailedSubject(subject: StudentSemesterResult["subjects"][number]): boolean {
  const grade = String(subject.grade || "").trim().toUpperCase();
  const status = String(subject.result_status || "").trim().toUpperCase();
  return grade === "F" || grade === "FAIL" || grade === "AB" || status.includes("FAIL");
}

function displayNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : String(value);
}

function creditsSummary(subjects: StudentSemesterResult["subjects"]): { earned: string; registered: string } {
  const registered = subjects.reduce((sum, subject) => sum + Number(subject.credits || 0), 0);
  const earned = subjects.reduce((sum, subject) => (isFailedSubject(subject) ? sum : sum + Number(subject.credits || 0)), 0);
  const format = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return { earned: format(earned), registered: format(registered) };
}

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

  const renderResultDetail = (semesterResult: StudentSemesterResult) => {
    const credits = creditsSummary(semesterResult.subjects);
    return (
    <div className="results-detail-shell">
      <button
        type="button"
        className="results-back-btn"
        onClick={() => setSelectedResultId(null)}
        aria-label="Back to semester selection"
      >
        <span aria-hidden="true">←</span>
        <span className="results-back-desktop">Back to semesters</span>
        <span className="results-back-mobile">Semesters</span>
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

        <div className="results-mobile-detail" aria-label="Mobile semester result">
          <header className="results-mobile-header">
            <div className="results-mobile-semester-context">
              {semesterContext(semesterResult.batch.semester_name, semesterResult.batch.semester_code)}
            </div>
            <div className="results-mobile-title">
              <h2>Semester Result</h2>
              <p>{programmeLabel(data?.student?.department)}</p>
            </div>
            <div className="results-mobile-identity">
              <div className="results-mobile-student">
                <strong>{data?.student?.name || user.username}</strong>
                <span>{data?.student?.roll_no || "—"}</span>
              </div>
              <div className="results-mobile-status">
                <strong className={String(semesterResult.result_status || "").toUpperCase() === "FAIL" ? "is-fail" : ""}>
                  {semesterResult.result_status || "—"}
                </strong>
                <span>SGPA {semesterResult.sgpa ?? "—"}</span>
              </div>
            </div>
          </header>

          <section className="results-mobile-marksheet" aria-labelledby="results-mobile-marksheet-title">
            <div className="results-mobile-section-label" id="results-mobile-marksheet-title">MARKSHEET</div>
            <div className="results-mobile-table-head" aria-hidden="true">
              <span>SUBJECT</span>
              <span>TOTAL</span>
              <span>GRADE</span>
              <span></span>
            </div>

            <div className="results-mobile-subject-list">
              {semesterResult.subjects.map((subject, i) => {
                const failed = isFailedSubject(subject);
                const total = `${displayNumber(subject.marks)}${subject.max_marks ? `/${displayNumber(subject.max_marks)}` : ""}`;
                return (
                  <details className={`results-mobile-subject${failed ? " is-failed" : ""}`} key={`${subject.subject_code}-${i}`}>
                    <summary>
                      <span className="results-mobile-subject-main">
                        <strong>{subject.subject_name}</strong>
                        <small>{subject.subject_code}</small>
                      </span>
                      <span className="results-mobile-total">{total}</span>
                      <span className={`results-mobile-grade${failed ? " is-failed" : ""}`}>{subject.grade || "—"}</span>
                      <span className="results-mobile-chevron" aria-hidden="true">›</span>
                    </summary>
                    <div className="results-mobile-subject-detail">
                      <div><span>Internal</span><strong>{displayNumber(subject.internal_marks)}</strong></div>
                      <div><span>External</span><strong>{displayNumber(subject.external_marks)}</strong></div>
                      <div><span>Total</span><strong>{total}</strong></div>
                      <div><span>Grade</span><strong>{subject.grade || "—"}</strong></div>
                      <div><span>Grade Point</span><strong>{subject.grade_point || "—"}</strong></div>
                      <div><span>Credits</span><strong>{subject.credits ?? "—"}</strong></div>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section className="results-mobile-outcome" aria-labelledby="results-mobile-outcome-title">
            <div className="results-mobile-section-label" id="results-mobile-outcome-title">SEMESTER OUTCOME</div>
            <div className="results-mobile-outcome-row">
              <span>Credits earned</span>
              <strong>{credits.earned} / {credits.registered}</strong>
            </div>
            <div className="results-mobile-outcome-row">
              <span>Result</span>
              <strong className={String(semesterResult.result_status || "").toUpperCase() === "FAIL" ? "is-fail" : ""}>{semesterResult.result_status || "—"}</strong>
            </div>
          </section>
        </div>

        <div className="results-summary-row">
          <div><span>Total Credits</span><strong>{Number(semesterResult.total_credits || 0).toFixed(2).replace(/\.00$/, "")}</strong></div>
          <div><span>Result</span><strong>{semesterResult.result_status || "—"}</strong></div>
        </div>
        <div className="results-generated-note">Generated from official semester result upload.</div>
      </section>
    </div>
    );
  };

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
