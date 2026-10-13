import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { deleteNote, getNoteDownloadUrl, getNoteUploadOptions, getNotes, type NoteItem, uploadNote } from "../../api/learning";
import "../../styles/ng-flat-controls.css";
import "./notes.css";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

function formatDate(value: string) {
  try { return new Date(String(value).replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return value; }
}

function fileTag(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "ppt" || ext === "pptx") return "PPT";
  if (ext === "doc" || ext === "docx") return "DOC";
  return ext ? ext.slice(0, 4).toUpperCase() : "FILE";
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
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [managing, setManaging] = useState(false);

  function toggle(key: string) {
    setOpen((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

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
    const map = new Map<string, { code: string; name: string; items: NoteItem[] }>();
    for (const note of notes) {
      const key = `${note.subject_code} · ${note.subject_name}`;
      const group = map.get(key) ?? { code: note.subject_code, name: note.subject_name, items: [] };
      group.items.push(note); map.set(key, group);
    }
    return [...map.values()];
  }, [notes]);

  const isStudent = user.role === "STUDENT";

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
    <AppShell user={user} activeNav="notes" heading="Notes" whoami={isStudent ? (user.student_roll_no && user.student_roll_no !== user.username ? `${user.username} · ${user.student_roll_no}` : user.username) : undefined} onLoggedOut={onLoggedOut}>
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

      {!isStudent && (
        <div className="nt-page-head">
          <h2 className="nt-page-title">My uploaded notes</h2>
          {grouped.length > 0 && (
            <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" aria-pressed={managing} onClick={() => setManaging((m) => !m)}>
              {managing ? "Done" : "Manage"}
            </button>
          )}
        </div>
      )}

      {loading ? <p className="empty-note">Loading notes…</p> : grouped.length === 0 ? (
        <div className="nt-empty">
          <strong>{isStudent ? "No notes yet" : "You haven't uploaded any notes"}</strong>
          {isStudent ? "Notes your faculty share for this semester will appear here, grouped by subject." : "Use the form above to share the first one."}
        </div>
      ) : (
        <div className="nt">
          {grouped.map((group) => {
            const key = group.code + group.name;
            const isOpen = open.has(key);
            const panelId = `nt-panel-${group.code.replace(/\W+/g, "")}`;
            return (
              <section key={key} className={`nt-group${isOpen ? " is-open" : ""}`}>
                <button type="button" className="nt-group-head" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(key)}>
                  <span className="nt-group-title">
                    <span className="nt-code">{group.code}</span>
                    <span className="nt-name">{group.name}</span>
                  </span>
                  <span className="nt-count" aria-label={`${group.items.length} files`}>{group.items.length}</span>
                  <svg className="nt-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {isOpen && (
                  <ul className="nt-list" id={panelId}>
                    {group.items.map((note) => (
                      <li key={note.id} className="nt-item">
                        <span className="nt-type" aria-hidden="true">{fileTag(note.original_filename)}</span>
                        <div className="nt-main">
                          <span className="nt-title">{note.title}</span>
                          <span className="nt-meta">
                            {isStudent ? note.faculty_name : note.original_filename} · {formatDate(note.created_at)}
                          </span>
                        </div>
                        <div className="nt-actions">
                          <a className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm" href={getNoteDownloadUrl(note.id)} aria-label={`Download ${note.title}`}>Download</a>
                          {user.role === "FACULTY" && managing && (
                            <button className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm nt-remove" type="button" onClick={() => void handleDelete(note)} aria-label={`Remove ${note.title}`}>Remove</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
