import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getStudentResultReport } from "../../api/students";
import type { StudentResultReport } from "../../api/learning";
import { ResultReport } from "../learning/ResultReport";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

// — Staff view of one student's result report (Faculty, HOD, Admin)
// WHY: access control is enforced by GET /api/students/{id}/results-report.
// This page only renders what the server returned; a student outside the
// caller's scope comes back as 404 and shows the error state, never data.
export function StudentResultReportPage({ user, onLoggedOut }: Props) {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<StudentResultReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(studentId);
    if (!Number.isFinite(id)) { setLoading(false); return; }
    void getStudentResultReport(id)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load results report"))
      .finally(() => setLoading(false));
  }, [studentId]);

  const whoami = report?.student ? `${report.student.name} · ${report.student.roll_no}` : undefined;

  return (
    <AppShell user={user} activeNav="students" heading="Results Report" whoami={whoami} onLoggedOut={onLoggedOut}>
      <div className="results-page-shell">
        <ErrorPopup message={error} onClose={() => setError(null)} />
        <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/students/${studentId}`)} style={{ marginBottom: 14 }}>← Student profile</button>
        {loading && <p className="empty-note">Loading results…</p>}
        {!loading && report && <ResultReport report={report} />}
        {!loading && !report && !error && <p className="empty-note">Student not found.</p>}
      </div>
    </AppShell>
  );
}
