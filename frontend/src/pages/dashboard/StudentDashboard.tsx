// Student Attendance Summary — one row per subject, lowest attendance first,
// each with a plain-language "what do I need to do" line. Tap a row to see
// the session-by-session history inline.
// Mirrors webapp/routes/dashboard.py's student_home() view, ported to React.
import { useState, useEffect, useCallback, useMemo, useId } from "react";
import {
  type StudentDashboardData,
  type SubjectAttendance,
  type SubjectHistoryData,
  type SubjectSessionHistoryEntry,
  type AttendanceBand,
  getDashboard,
  getSubjectHistory,
} from "../../api/dashboard";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { AppShell } from "../../components/AppShell";
import "../../styles/ng-flat-controls.css";
import "./student-attendance.css";

interface StudentDashboardProps {
  user: CurrentUser;
  onLoggedOut: () => void;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// Eligibility line used across the product (api/routes_dashboard.py: >=75 is
// eligible; 50–74 low; <50 critical). Keep in step with attendance_pct_band().
const TARGET = 75;

type Tone = "green" | "amber" | "red" | "muted";

function toneOf(band: AttendanceBand): Tone {
  if (band === "green") return "green";
  if (band === "yellow") return "amber";
  if (band === "red") return "red";
  return "muted";
}

function toneOfPct(pct: number): Tone {
  return pct >= TARGET ? "green" : pct >= 50 ? "amber" : "red";
}

function flagLabel(band: AttendanceBand): string | null {
  if (band === "yellow") return "Low";
  if (band === "red") return "Critical";
  return null; // "Good" is the norm — only the exceptions get a label
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the student has to do to stay at / get back to 75%, from present + total only. */
function planFor(s: SubjectAttendance): string {
  if (s.total === 0) return "No sessions yet";
  if (s.present * 100 >= TARGET * s.total) {
    const canMiss = Math.floor((4 * s.present - 3 * s.total) / 3);
    return canMiss >= 1 ? `Can miss ${canMiss} more` : "Can't miss the next one";
  }
  const need = 3 * s.total - 4 * s.present;
  return `Attend next ${need} to reach ${TARGET}%`;
}

/** Subjects under 75% first (lowest first), then the rest in the order given, no-data last. */
function byRisk(subjects: SubjectAttendance[]): SubjectAttendance[] {
  const rank = (s: SubjectAttendance) => (s.total === 0 ? 2 : s.present * 100 < TARGET * s.total ? 0 : 1);
  const ratio = (s: SubjectAttendance) => (s.total ? s.present / s.total : 1);
  return subjects
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || (rank(a.s) === 0 ? ratio(a.s) - ratio(b.s) : 0) || a.i - b.i)
    .map((x) => x.s);
}

function fmtDate(s: string): string {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return s; }
}

function Chevron() {
  return (
    <svg className="sa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Meter({ pct }: { pct: number | null }) {
  return (
    <span className="sa-meter" aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
    </span>
  );
}

// ──────────────────────────────────────────────
// History panel (inside an open subject row)
// ──────────────────────────────────────────────

function stateClass(status: SubjectSessionHistoryEntry["status"]): string {
  return status === "Present" ? "" : status === "Absent" ? "is-absent" : "is-other";
}

function History({
  history, loading, error, onRetry,
}: {
  history: SubjectHistoryData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="sa-detail" aria-busy="true">
        <div className="sa-skel" style={{ height: 16, width: "60%", marginBottom: 14 }} />
        <div className="sa-skel" style={{ height: 40, marginBottom: 6 }} />
        <div className="sa-skel" style={{ height: 40, marginBottom: 6 }} />
        <div className="sa-skel" style={{ height: 40 }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="sa-detail">
        <p className="sa-detail-note" role="alert">
          {error}
          <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm sa-retry" onClick={onRetry}>
            Try again
          </button>
        </p>
      </div>
    );
  }
  if (!history || history.sessions.length === 0) {
    return <div className="sa-detail"><p className="sa-detail-note">No sessions recorded for this subject yet.</p></div>;
  }

  const sessions = history.sessions; // newest first
  const absences = sessions.filter((x) => x.status === "Absent").length;
  const PREVIEW = 10;
  const canCollapse = !onlyAbsent && sessions.length > PREVIEW;
  const shown = onlyAbsent
    ? sessions.filter((x) => x.status === "Absent")
    : canCollapse && !showAll ? sessions.slice(0, PREVIEW) : sessions;
  const oldestFirst = [...sessions].reverse();

  return (
    <div className="sa-detail">
      <div className="sa-detail-top">
        <div className="sa-strip-wrap">
          <span className="sa-strip-cap">
            {plural(sessions.length, "session")}, oldest to newest
          </span>
          <div className="sa-strip" aria-hidden="true">
            {oldestFirst.map((x, i) => (
              <i key={i} className={x.status === "Present" ? "" : x.status === "Absent" ? "absent" : "other"} />
            ))}
          </div>
        </div>
        {absences > 0 && (
          <div className="sa-seg" role="group" aria-label="Filter sessions">
            <button type="button" aria-pressed={!onlyAbsent} onClick={() => setOnlyAbsent(false)}>
              All {sessions.length}
            </button>
            <button type="button" aria-pressed={onlyAbsent} onClick={() => setOnlyAbsent(true)}>
              Absent {absences}
            </button>
          </div>
        )}
      </div>

      <ul className="sa-sessions">
        {shown.map((x, i) => (
          <li key={i} className={`sa-session ${stateClass(x.status)}`}>
            <span className="sa-session-when">
              {fmtDate(x.attendance_date)}
              <span>{x.session_type === "LAB" ? "Lab" : "Class"} · {x.duration_hours}h</span>
            </span>
            <span className="sa-session-state">{x.status}</span>
          </li>
        ))}
      </ul>
      {canCollapse && (
        <button type="button" className="ng-flat-btn ng-flat-btn-outline ng-flat-btn-sm sa-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${sessions.length} sessions`}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// One subject row (accordion)
// ──────────────────────────────────────────────

function SubjectRow({
  subj, open, onToggle,
}: {
  subj: SubjectAttendance;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const [history, setHistory] = useState<SubjectHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await getSubjectHistory(subj.subject_id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load this history.");
    } finally {
      setLoading(false);
    }
  }, [subj.subject_id]);

  // Fetch the first time the row opens; reopening reuses what's loaded.
  useEffect(() => {
    if (open && !history && !loading && !error) void fetchHistory();
  }, [open, history, loading, error, fetchHistory]);

  const tone = toneOf(subj.band);
  const flag = flagLabel(subj.band);

  return (
    <li id={`subject-card-${subj.subject_id}`} className={`sa-subject tone-${tone}${open ? " is-open" : ""}`}>
      <button type="button" className="sa-row" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
        <span className="sa-id">
          <span className="sa-name">{subj.name}</span>
          <span className="sa-code">{subj.code}</span>
        </span>
        <Meter pct={subj.pct} />
        <span className="sa-plan">
          <strong>{planFor(subj)}</strong>
          <span>{subj.present} of {plural(subj.total, "session")}</span>
        </span>
        <span className="sa-pct">
          <span className="sa-pct-num">{subj.pct !== null ? `${subj.pct}%` : "—"}</span>
          {flag && <span className="sa-flag">{flag}</span>}
        </span>
        <Chevron />
      </button>
      <div id={panelId} role="region" aria-label={`${subj.name} session history`} hidden={!open}>
        {open && <History history={history} loading={loading} error={error} onRetry={fetchHistory} />}
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────
// Main Student Dashboard
// ──────────────────────────────────────────────

export function StudentDashboard({ user, onLoggedOut }: StudentDashboardProps) {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      if (res.role !== "STUDENT") return;
      setData(res as StudentDashboardData);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const subjects = useMemo(() => byRisk(data?.subjects ?? []), [data]);

  const totals = useMemo(() => {
    const total = subjects.reduce((n, s) => n + s.total, 0);
    const present = subjects.reduce((n, s) => n + s.present, 0);
    const under = subjects.filter((s) => s.total > 0 && s.present * 100 < TARGET * s.total);
    const below = under.length;
    const belowTone: Tone = under.some((s) => s.band === "red") ? "red" : "amber";
    return { total, present, below, belowTone, pct: total > 0 ? Math.round((present * 100) / total) : null };
  }, [subjects]);

  const whoami = `${data?.student.name || user.username}${data?.student.roll_no ? ` · ${data.student.roll_no}` : ""}`;
  const overallTone: Tone = totals.pct === null ? "muted" : toneOfPct(totals.pct);

  return (
    <AppShell user={user} activeNav="attendance-summary" heading="Attendance Summary" whoami={whoami} onLoggedOut={onLoggedOut}>
      <div className="sa">
        {loading && (
          <>
            <div className="sa-summary" aria-busy="true">
              <div className="sa-skel" style={{ height: 64, width: 120 }} />
              <div className="sa-skel" style={{ height: 40 }} />
            </div>
            <div className="sa-list">
              {[0, 1, 2, 3].map((i) => (
                <div className="sa-skel-row" key={i}>
                  <div className="sa-skel" style={{ height: 34, width: "45%" }} />
                  <div className="sa-skel" style={{ height: 24, width: 70 }} />
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && error && (
          <div className="sa-state" role="alert">
            <strong>Couldn't load your attendance</strong>
            {error}
            <div>
              <button type="button" className="ng-flat-btn ng-flat-btn-primary ng-flat-btn-sm" onClick={load}>Try again</button>
            </div>
          </div>
        )}

        {!loading && !error && data && subjects.length === 0 && (
          <div className="sa-state">
            <strong>No attendance recorded yet</strong>
            Your subjects appear here once a session has been marked.
          </div>
        )}

        {!loading && !error && data && subjects.length > 0 && (
          <>
            <section className={`sa-summary tone-${overallTone}`} aria-label="Overall attendance">
              <div className="sa-overall">
                <span className="sa-overall-label">Overall</span>
                <span className="sa-overall-num">{totals.pct !== null ? `${totals.pct}%` : "—"}</span>
              </div>
              <div className="sa-summary-side">
                <Meter pct={totals.pct} />
                <div className="sa-summary-line">
                  <span><strong>{totals.present}</strong> of {totals.total} sessions attended</span>
                  <span className={totals.below > 0 ? `sa-summary-flag tone-${totals.belowTone}` : undefined}>
                    {totals.below > 0
                      ? `${plural(totals.below, "subject")} below ${TARGET}%`
                      : `All subjects at ${TARGET}% or above`}
                  </span>
                </div>
              </div>
            </section>

            <ul className="sa-list">
              {subjects.map((s) => (
                <SubjectRow
                  key={s.subject_id}
                  subj={s}
                  open={openId === s.subject_id}
                  onToggle={() => setOpenId(openId === s.subject_id ? null : s.subject_id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
