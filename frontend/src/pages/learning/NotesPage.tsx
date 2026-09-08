import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { deleteNote, getNoteDownloadUrl, getNoteUploadOptions, getNotes, type NoteItem, uploadNote } from "../../api/learning";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

function formatDate(value: string) {
  try { return new Date(String(value).replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return value; }
}

export function NotesPage({ user, onLoggedOut }: Props) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [subjects, setSubjects] = useState<Awaited<ReturnType<typeof getNoteUploadOptions>>["subjects"]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await getNotes();
      setNotes(res.notes);
      if (user.role === "FACULTY") {
        const opts = await getNoteUploadOptions();
        setSubjects(opts.subjects);
        if (!selectedSubject && opts.subjects.length) setSelectedSubject(opts.subjects[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load notes");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [user.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = new Map<string, NoteItem[]>();
    for (const note of notes) {
      const key = `${note.subject_code} · ${note.subject_name}`;
      const arr = map.get(key) ?? [];
      arr.push(note); map.set(key, arr);
    }
    return [...map.entries()];
  }, [notes]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubject || !title.trim() || !file) { setError("Choose a subject, enter a note title, and select a file."); return; }
    setUploading(true); setError(null); setMessage(null);
    try {
      await uploadNote(Number(selectedSubject), title.trim(), file);
      setTitle(""); setFile(null);
      const input = document.getElementById("note-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("Notes uploaded and made available to students in this subject.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally { setUploading(false); }
  }

  async function handleDelete(note: NoteItem) {
    if (!window.confirm(`Remove “${note.title}” from students?`)) return;
    setError(null); setMessage(null);
    try { await deleteNote(note.id); setMessage("Note removed."); await load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Failed to remove note"); }
  }

  return (
    <AppShell user={user} activeNav="notes" heading="Notes" whoami={user.role === "STUDENT" ? `${user.username} · ${user.student_roll_no ?? ""}` : undefined} onLoggedOut={onLoggedOut}>
      {message && <div className="success-banner">{message}</div>}
      {error && <div className="error-banner">{error}</div>}

      {user.role === "FACULTY" && (
        <div className="detail-box" style={{ marginBottom: 22 }}>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Send Notes</h2>
              <p className="subtitle-muted" style={{ margin: 0 }}>Choose one of your assigned subjects. Students in that subject’s current semester will see the note immediately.</p>
            </div>
          </div>
          <form onSubmit={handleUpload}>
            <div className="form-grid">
              <div className="field">
                <label>Subject *</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : "")} required>
                  <option value="">— Select subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name} ({s.semester_code})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Note title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 2 — Trees & Graphs" maxLength={180} required />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>File *</label>
                <input id="note-file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
                <div className="subtitle-muted" style={{ marginTop: 6 }}>PDF, PPT, PPTX, DOC or DOCX · maximum 15MB.</div>
              </div>
            </div>
            <button className="btn" type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload Notes"}</button>
          </form>
        </div>
      )}

      <div className="section-head" style={{ marginBottom: 14 }}>
        <div><h2 style={{ marginBottom: 4 }}>{user.role === "STUDENT" ? "Subject Notes" : "My Uploaded Notes"}</h2><p className="subtitle-muted" style={{ margin: 0 }}>{user.role === "STUDENT" ? "Notes shared by your faculty, organized subject wise." : "Your published notes, grouped by subject."}</p></div>
      </div>

      {loading ? <p className="empty-note">Loading notes…</p> : grouped.length === 0 ? <div className="card card-pad empty-note">{user.role === "STUDENT" ? "No notes have been shared for your current semester yet." : "You have not uploaded any notes yet."}</div> : (
        <div style={{ display: "grid", gap: 16 }}>
          {grouped.map(([subject, items]) => (
            <section key={subject} className="card card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{subject}</h3>
                <span className="subtitle-muted">{items.length} note{items.length === 1 ? "" : "s"}</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {items.map(note => (
                  <div key={note.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--card-glass)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{note.original_filename} · {note.faculty_name} · {formatDate(note.created_at)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <a className="btn btn-sm btn-outline" href={getNoteDownloadUrl(note.id)}>Download</a>
                      {user.role === "FACULTY" && <button className="btn btn-sm btn-outline" type="button" onClick={() => void handleDelete(note)}>Remove</button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
