import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getResultsOptions, uploadResults } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

export function ResultsUploadPage({ user, onLoggedOut }: Props) {
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getResultsOptions>> | null>(null);
  const [branch, setBranch] = useState("CSD");
  const [semesterId, setSemesterId] = useState<number | "">("");
  const [title, setTitle] = useState("Semester Result");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getResultsOptions();
        setOptions(res);
        const first = res.semesters.find(s => s.active);
        if (first) setSemesterId(first.id);
      } catch (err) { setError(err instanceof ApiClientError ? err.message : "Failed to load result upload options"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch || !semesterId || !title.trim() || !file) { setError("Choose branch, semester, result title, and an Excel file."); return; }
    setUploading(true); setError(null); setMessage(null);
    try {
      const res = await uploadResults(branch, Number(semesterId), title.trim(), file);
      setMessage(`${res.rows_imported} result rows imported for ${res.students_affected} students in ${res.department} / ${res.semester_code}.`);
      setFile(null);
      const input = document.getElementById("results-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Results upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <AppShell user={user} activeNav="results-admin" heading="Results Upload" onLoggedOut={onLoggedOut}>
      {message && <div className="success-banner">{message}</div>}
      {error && <div className="error-banner">{error}</div>}
      <div className="detail-box">
        <h2 style={{ marginBottom: 6 }}>Upload Student Results</h2>
        <p className="subtitle-muted" style={{ maxWidth: 800, marginTop: 0 }}>Select the destination Branch and Semester before uploading. Every row is checked against an active student in that exact branch + semester, so results cannot land in another batch.</p>

        {loading ? <p className="empty-note">Loading…</p> : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Branch *</label>
                <select value={branch} onChange={e => setBranch(e.target.value)} required>
                  {options?.branches.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Semester *</label>
                <select value={semesterId} onChange={e => setSemesterId(e.target.value ? Number(e.target.value) : "")} required>
                  <option value="">— Select semester —</option>
                  {options?.semesters.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code}){!s.active ? " [inactive]" : ""}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Result title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="e.g. End Semester Results" required />
              </div>
              <div className="field">
                <label>Excel file *</label>
                <input id="results-file" type="file" accept=".xlsx,.xlsm" onChange={e => setFile(e.target.files?.[0] ?? null)} required />
              </div>
            </div>

            <div style={{ margin: "18px 0", padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--card-glass)" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Excel format</div>
              <div className="subtitle-muted" style={{ lineHeight: 1.65 }}>
                Required columns: <strong>Roll No, Subject Code, Subject Name, Marks</strong>.<br />
                Optional: Max Marks, Grade, Grade Point, Result Status, SGPA, Percentage.<br />
                One row = one student + one subject result. The sheet’s first row must contain the column headers.
              </div>
            </div>
            <button className="btn" type="submit" disabled={uploading}>{uploading ? "Validating & Uploading…" : "Upload Results"}</button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
