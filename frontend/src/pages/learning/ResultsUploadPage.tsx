import { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError, getAuthUrl } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { getResultsOptions, uploadResults } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

export function ResultsUploadPage({ user, onLoggedOut }: Props) {
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getResultsOptions>> | null>(null);
  const [batch, setBatch] = useState("");
  const [branch, setBranch] = useState("CSD");
  const [semesterId, setSemesterId] = useState<number | "">("");
  const [title, setTitle] = useState("Semester Result");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof uploadResults>> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getResultsOptions();
        setOptions(res);
        if (res.batches.length) setBatch(res.batches[0]);
        const first = res.semesters.find(s => s.active);
        if (first) setSemesterId(first.id);
      } catch (err) { setError(err instanceof ApiClientError ? err.message : "Failed to load result upload options"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batch || !branch || !semesterId || !title.trim() || !file) { setError("Choose batch, branch, semester, result title, and an Excel file."); return; }
    setUploading(true); setError(null); setResult(null);
    try {
      const res = await uploadResults(branch, batch, Number(semesterId), title.trim(), file);
      setResult(res);
      setFile(null);
      const input = document.getElementById("results-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Results upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <AppShell user={user} activeNav="results-admin" heading="Results Upload" onLoggedOut={onLoggedOut}>
      {error && <div className="error-banner">{error}</div>}
      <div className="detail-box">
        <h2 style={{ marginBottom: 6 }}>Upload Student Results</h2>
        <p className="subtitle-muted" style={{ maxWidth: 840, marginTop: 0 }}>Upload either the existing one-row-per-subject format or the official 3-row VR24 result-analysis format. The importer detects the shape automatically, validates every mapped value, and reports every recognized or ignored header.</p>

        {loading ? <p className="empty-note">Loading…</p> : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Batch *</label>
                <select value={batch} onChange={e => setBatch(e.target.value)} required>
                  <option value="">— Select batch —</option>
                  {options?.batches.map(b => <option key={b} value={b}>{b} Batch</option>)}
                </select>
              </div>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Excel template</div>
                  <div className="subtitle-muted" style={{ lineHeight: 1.55 }}>Includes the real 3-row wide-format header shape and sample subject blocks.</div>
                </div>
                <a className="btn btn-outline" href={getAuthUrl("/api/results/template")} download="NextGen-results-template.xlsx" style={{ whiteSpace: "nowrap", textDecoration: "none" }}>Download Template</a>
              </div>
              <div className="subtitle-muted" style={{ lineHeight: 1.65, marginTop: 12 }}>
                Wide format: <strong>S NO, H T NO</strong>, then repeating <strong>IM, EM, TM, G, GP, C</strong> blocks under each subject. Long format remains supported: one row per student + subject.
              </div>
            </div>

            <button className="btn" type="submit" disabled={uploading}>{uploading ? "Validating & Uploading…" : "Upload Results"}</button>
          </form>
        )}

        {result && (
          <div style={{ marginTop: 20, border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div className="success-banner" style={{ marginBottom: 12 }}>
              {result.rows_imported} result rows imported for {result.students_affected} students in {result.department} / {result.semester_code}. Detected format: {result.source_format}.
            </div>
            {result.skipped_count > 0 && (
              <div style={{ marginBottom: 12, padding: "10px 12px", border: "1px solid #fcd34d", borderRadius: 10, background: "#fffbeb", color: "#92400e", fontSize: 13 }}>
                <strong>{result.skipped_count} student{result.skipped_count === 1 ? "" : "s"} skipped</strong> because they are not registered in the app for the selected branch/batch. Their Excel rows were not imported.
              </div>
            )}
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Column Mapping</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: result.column_mapping.ignored.length ? 10 : 0 }}>
              {result.column_mapping.mapped.map((m, i) => (
                <span key={`${m.header}-${m.field}-${i}`} className="chip" style={{ background: "#dcfce7", color: "#166534", fontWeight: 700, padding: "3px 9px", fontSize: 11.5 }} title={m.matched_via === "fuzzy" ? "Similarity matched" : "Exact normalized match"}>
                  "{m.header}" → {m.field}{m.matched_via === "fuzzy" ? " ~" : ""}
                </span>
              ))}
            </div>
            {result.column_mapping.ignored.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.column_mapping.ignored.map((header, i) => <span key={`${header}-${i}`} className="chip" style={{ background: "#f1f5f9", color: "var(--muted)", fontWeight: 700, padding: "3px 9px", fontSize: 11.5 }}>&quot;{header}&quot; ignored</span>)}
              </div>
            ) : <div className="subtitle-muted" style={{ fontSize: 11.5 }}>Every detected import column was recognized.</div>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
