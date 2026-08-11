import { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { getAuditLogs, type AuditLogRow } from "../../api/logs";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function AuditLogPage({ user, onLoggedOut }: Props) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        setRows(await getAuditLogs());
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load audit logs");
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <AppShell user={user} activeNav="audit" heading="Audit Log" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Username</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>{r.created_at}</td>
                <td><strong>{r.username}</strong></td>
                <td><span className="chip chip-muted">{r.action}</span></td>
                <td>{r.entity}</td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{r.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty-note">Loading audit logs…</p>}
        {!loading && rows.length === 0 && <p className="empty-note">No audit log entries found.</p>}
      </div>
    </AppShell>
  );
}
