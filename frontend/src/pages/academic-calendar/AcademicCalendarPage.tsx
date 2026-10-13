// Group 5 — Academic Calendar page for all roles.
// Mirrors webapp/routes/academic_calendar.py + templates/academic_calendar/list.html.
// Semesters are COLLAPSED BY DEFAULT, expanding on click.
// Upload/load errors are shown in RED (.error-banner), NOT green.
import { useState, useEffect, useRef } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import {
  getCalendarPage, uploadCalendarFile, deleteCalendarFile,
  type CalendarPageData, type CalendarSemester,
} from "../../api/academicCalendar";
import { ApiClientError, getAuthUrl } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import "../../styles/ng-flat-controls.css";
import "./academic-calendar.css";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function AcademicCalendarPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<CalendarPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // `${semId}-${kind}`
  // Collapsed by default — tracks which semester IDs are expanded
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const initialised = useRef(false);

  async function reload() {
    setLoading(true); setError(null);
    try {
      const res = await getCalendarPage();
      // First load only: when there is nothing to choose between (one semester) or the
      // viewer can't edit (a student), open the first semester so the documents are
      // already on screen. Staff with many semesters keep the collapsed list.
      if (!initialised.current) {
        initialised.current = true;
        if (res.semesters.length > 0 && (res.semesters.length === 1 || !res.can_edit)) {
          setExpanded({ [res.semesters[0].id]: true });
        }
      }
      setData(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load calendar");
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSemester(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleUpload(sem: CalendarSemester, kind: "timetable" | "calendar", file: File) {
    const key = `${sem.id}-${kind}`;
    setUploading(key);
    setError(null);
    try {
      await uploadCalendarFile(sem.id, kind, file);
      setNotice(`${kind === "timetable" ? "Timetable" : "Academic Calendar"} updated for ${sem.code}`);
      await reload();
    } catch (err) {
      // Error MUST be in RED (.error-banner), NOT green notice
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally { setUploading(null); }
  }

  async function handleDelete(sem: CalendarSemester, kind: "timetable" | "calendar") {
    const label = kind === "timetable" ? "Timetable" : "Academic Calendar";
    if (!window.confirm(`Delete ${label} for ${sem.code}?`)) return;
    const key = `${sem.id}-${kind}`;
    setUploading(key);
    setError(null);
    try {
      await deleteCalendarFile(sem.id, kind);
      setNotice(`${label} deleted for ${sem.code}`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Delete failed");
    } finally { setUploading(null); }
  }

  if (loading) return (
    <AppShell user={user} activeNav="academic-calendar" heading="Academic Calendar" onLoggedOut={onLoggedOut}>
      <p className="empty-note">Loading…</p>
    </AppShell>
  );

  return (
    <AppShell user={user} activeNav="academic-calendar" heading="Academic Calendar" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}

      {(!data || data.semesters.length === 0) && (
        <div className="cal-empty">
          <strong>No documents yet</strong>
          The timetable and academic calendar for your semester will appear here once they're uploaded.
        </div>
      )}

      <div className="cal-page">
        {data?.semesters.map((sem) => {
          const isOpen = !!expanded[sem.id];
          const count = (sem.timetable_path ? 1 : 0) + (sem.calendar_path ? 1 : 0);
          const panelId = `cal-docs-${sem.id}`;
          return (
            <section key={sem.id} className={`cal-semester${isOpen ? " is-open" : ""}`}>
              <button type="button" className="cal-sem-head" onClick={() => toggleSemester(sem.id)} aria-expanded={isOpen} aria-controls={panelId}>
                <span className="cal-sem-title">
                  {sem.name} <span className="cal-sem-code">{sem.code}</span>
                </span>
                <span className="cal-sem-count">{count === 0 ? "No documents" : count === 1 ? "1 document" : "2 documents"}</span>
                <svg className="cal-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {isOpen && (
                <div className="cal-docs" id={panelId}>
                  <DocPanel
                    label="Timetable"
                    path={sem.timetable_path}
                    canEdit={!!data.can_edit}
                    uploading={uploading === `${sem.id}-timetable`}
                    onUpload={file => handleUpload(sem, "timetable", file)}
                    onDelete={() => handleDelete(sem, "timetable")}
                  />
                  <DocPanel
                    label="Academic Calendar"
                    path={sem.calendar_path}
                    canEdit={!!data.can_edit}
                    uploading={uploading === `${sem.id}-calendar`}
                    onUpload={file => handleUpload(sem, "calendar", file)}
                    onDelete={() => handleDelete(sem, "calendar")}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

interface DocPanelProps {
  label: string;
  path: string | null;
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

// One document = one compact row: name on the left, what you can do with it on the right.
function DocPanel({ label, path, canEdit, uploading, onUpload, onDelete }: DocPanelProps) {
  const fileUrl = path ? getAuthUrl(`/api${path}`) : null;

  return (
    <div className="cal-doc">
      <div className="cal-doc-name">
        <h4>{label}</h4>
        {!fileUrl && <span className="cal-doc-missing">Not uploaded yet</span>}
      </div>
      <div className="cal-doc-actions">
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ng-flat-btn ng-flat-btn-sm ng-flat-btn-outline"
            aria-label={`Open ${label.toLowerCase()}`}
          >
            Open
          </a>
        )}
        {canEdit && (
          <>
            <label className={`ng-flat-btn ng-flat-btn-sm ng-flat-btn-outline cal-upload${uploading ? " is-busy" : ""}`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
              {uploading ? "Uploading…" : path ? "Replace" : "Upload"}
            </label>
            {path && (
              <button
                type="button"
                className="ng-flat-btn ng-flat-btn-sm ng-flat-btn-outline cal-remove"
                onClick={onDelete}
                disabled={uploading}
                aria-label={`Remove ${label.toLowerCase()}`}
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
