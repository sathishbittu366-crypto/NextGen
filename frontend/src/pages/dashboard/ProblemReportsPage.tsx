import { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import { type CurrentUser } from "../../api/auth";
import { getProblemReports, updateReportStatus, type ProblemReport } from "../../api/reports";
import { ApiClientError } from "../../api/client";

interface ProblemReportsPageProps {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function ProblemReportsPage({ user, onLoggedOut }: ProblemReportsPageProps) {
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [notesState, setNotesState] = useState<Record<number, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const res = await getProblemReports();
      setReports(res.reports);
      // Initialize notes state
      const initialNotes: Record<number, string> = {};
      res.reports.forEach((r) => {
        initialNotes[r.id] = r.admin_notes || "";
      });
      setNotesState(initialNotes);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to load problem reports.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function handleStatusChange(reportId: number, newStatus: string) {
    setUpdatingId(reportId);
    setError(null);
    try {
      await updateReportStatus(reportId, newStatus, notesState[reportId]);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus as any, admin_notes: notesState[reportId] } : r))
      );
      setSuccessMsg(`Report #${reportId} status updated to ${newStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to update status.");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotes(reportId: number, currentStatus: string) {
    setUpdatingId(reportId);
    setError(null);
    try {
      await updateReportStatus(reportId, currentStatus, notesState[reportId]);
      setSuccessMsg(`Notes saved for Report #${reportId}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to save notes.");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredReports = reports.filter((r) => filterStatus === "ALL" || r.status === filterStatus);

  const pendingCount = reports.filter((r) => r.status === "PENDING").length;
  const inProgressCount = reports.filter((r) => r.status === "IN_PROGRESS").length;
  const resolvedCount = reports.filter((r) => r.status === "RESOLVED").length;

  return (
    <AppShell user={user} activeNav="problem-reports" heading="User Problem Reports" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {successMsg && <ToastPopup type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p className="sub" style={{ marginBottom: 20 }}>
          Manage user-submitted problem reports across the application. Only system administrators can view this page.
        </p>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <span className="stat-label">Total Reports</span>
            <span className="stat-value">{reports.length}</span>
          </div>
          <div className="stat-card" style={{ borderColor: "rgba(251, 191, 36, 0.3)" }}>
            <span className="stat-label" style={{ color: "#fbbf24" }}>Pending Review</span>
            <span className="stat-value" style={{ color: "#fbbf24" }}>{pendingCount}</span>
          </div>
          <div className="stat-card" style={{ borderColor: "rgba(56, 189, 248, 0.3)" }}>
            <span className="stat-label" style={{ color: "#38bdf8" }}>In Progress</span>
            <span className="stat-value" style={{ color: "#38bdf8" }}>{inProgressCount}</span>
          </div>
          <div className="stat-card" style={{ borderColor: "rgba(34, 197, 94, 0.3)" }}>
            <span className="stat-label" style={{ color: "#22c55e" }}>Resolved</span>
            <span className="stat-value" style={{ color: "#22c55e" }}>{resolvedCount}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["ALL", "PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${filterStatus === st ? "btn-primary" : "btn-outline"}`}
                onClick={() => setFilterStatus(st)}
              >
                {st === "ALL" ? "All" : st.replace("_", " ")}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={fetchReports} disabled={loading}>
            {loading ? "Refreshing…" : "🔄 Refresh"}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading reports…</div>
        ) : filteredReports.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            No problem reports found matching status filter "{filterStatus}".
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="card"
                style={{
                  padding: 20,
                  borderLeft: `4px solid ${
                    report.status === "PENDING"
                      ? "#fbbf24"
                      : report.status === "IN_PROGRESS"
                      ? "#38bdf8"
                      : report.status === "RESOLVED"
                      ? "#22c55e"
                      : "#64748b"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <span className="badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                        {report.category}
                      </span>
                      <span className="badge" style={{ background: "rgba(255, 255, 255, 0.1)", color: "#cbd5e1" }}>
                        Submitted by <strong>{report.username}</strong> ({report.role})
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(report.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 style={{ margin: "4px 0 0 0", color: "#f8fafc", fontSize: 18 }}>{report.subject}</h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label htmlFor={`status-${report.id}`} style={{ fontSize: 13, color: "#94a3b8" }}>
                      Status:
                    </label>
                    <select
                      id={`status-${report.id}`}
                      value={report.status}
                      disabled={updatingId === report.id}
                      onChange={(e) => handleStatusChange(report.id, e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "rgba(15, 23, 42, 0.8)",
                        color:
                          report.status === "PENDING"
                            ? "#fbbf24"
                            : report.status === "IN_PROGRESS"
                            ? "#38bdf8"
                            : report.status === "RESOLVED"
                            ? "#22c55e"
                            : "#94a3b8",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    padding: 14,
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    marginBottom: 16,
                    lineHeight: 1.5,
                  }}
                >
                  {report.description}
                </div>

                {/* Admin Notes Section */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <label htmlFor={`notes-${report.id}`} style={{ fontSize: 13, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                    Admin Resolution Notes (Internal):
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      id={`notes-${report.id}`}
                      type="text"
                      placeholder="Add notes on how this problem was investigated/resolved..."
                      value={notesState[report.id] ?? ""}
                      onChange={(e) => setNotesState({ ...notesState, [report.id]: e.target.value })}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(15, 23, 42, 0.6)",
                        color: "#fff",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleSaveNotes(report.id, report.status)}
                      disabled={updatingId === report.id}
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
