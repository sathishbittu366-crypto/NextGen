import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportAttempt, ReportSubject, StudentResultReport } from "../../api/learning";
import "./result-report.css";

// — Types & constants
type Scope = "semester" | "all" | "till-now";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "semester", label: "Semester" },
  { key: "all", label: "All semesters" },
  { key: "till-now", label: "Till now" },
];

interface SemesterGroup {
  code: string;
  name: string;
  attempts: ReportAttempt[];
}

// — Formatting helpers
function programmeLabel(department: string | null | undefined): string {
  const d = String(department || "").trim().toUpperCase();
  if (d === "CSD" || !d) return "B.Tech CSE (Data Science)";
  return String(department).trim();
}

function fmt(value: number | null | undefined): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

// WHY: SGPA/CGPA are always shown to two decimals (7.00, 8.60) so a whole-number
// result never reads differently from the rest of the ladder.
function gpa(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}

function show(value: number | string | null | undefined): string {
  return value == null || value === "" ? "—" : String(value);
}

function totalLabel(s: ReportSubject): string {
  if (s.marks == null) return "—";
  return s.max_marks ? `${fmt(s.marks)}/${fmt(s.max_marks)}` : fmt(s.marks);
}

// — Pass/fail ribbon: one tick per subject, failures carry the colour
// WHY: a donut hides WHICH subject failed. A tick per subject keeps the count
// and the position visible, and a single failure still reads at a glance.
function Ribbon({ subjects }: { subjects: ReportSubject[] }) {
  const failed = subjects.filter((s) => s.status === "FAIL").length;
  return (
    <div className="rr-ribbon" role="img" aria-label={`${subjects.length - failed} of ${subjects.length} subjects passed`}>
      {subjects.map((s, i) => (
        <span
          key={`${s.subject_code}-${i}`}
          className={`rr-tick rr-tick-${s.status.toLowerCase()}`}
          title={`${s.subject_name ?? s.subject_code} — ${s.grade || "no grade"}`}
        />
      ))}
    </div>
  );
}

// — One subject row (desktop grid; collapses to name + grade on phones)
function SubjectRow({ s }: { s: ReportSubject }) {
  const failed = s.status === "FAIL";
  const cleared = failed && !!s.cleared_in;
  return (
    <li className={`rr-row${failed ? (cleared ? " is-cleared" : " is-failed") : ""}`}>
      <div className="rr-row-main">
        <strong>{s.subject_name ?? s.subject_code}</strong>
        <small>
          {s.subject_code}
          {s.attempt_no > 1 ? ` · Attempt ${s.attempt_no}` : ""}
        </small>
        {failed && (
          <span className={`rr-flag${cleared ? " is-cleared" : ""}`}>
            {cleared ? `Cleared in ${s.cleared_in}` : "Backlog pending"}
          </span>
        )}
        <span className="rr-meta">
          {totalLabel(s)} · GP {show(s.grade_point)}
          {s.credits != null ? ` · ${fmt(s.credits)} cr` : ""}
        </span>
      </div>
      <span className="rr-num">{show(s.internal_marks)}</span>
      <span className="rr-num">{show(s.external_marks)}</span>
      <span className="rr-num">{totalLabel(s)}</span>
      <span className="rr-num">{show(s.grade_point)}</span>
      <span className={`rr-grade${failed && !cleared ? " is-failed" : ""}`}>{s.grade || "—"}</span>
    </li>
  );
}

function SubjectList({ subjects }: { subjects: ReportSubject[] }) {
  return (
    <ul className="rr-list">
      <li className="rr-head" aria-hidden="true">
        <span>Subject</span>
        <span>Internal</span>
        <span>External</span>
        <span>Total</span>
        <span>GP</span>
        <span>Grade</span>
      </li>
      {subjects.map((s, i) => (
        <SubjectRow key={`${s.subject_code}-${i}`} s={s} />
      ))}
    </ul>
  );
}

// — Stat ledger: one primary figure, the rest quiet
function Stat({ label, value, tag, primary, alert }: { label: string; value: string; tag?: { text: string; hint: string }; primary?: boolean; alert?: boolean }) {
  return (
    <div className={`rr-stat${primary ? " is-primary" : ""}${alert ? " is-alert" : ""}`}>
      <dt>
        {label}
        {tag && <span className="rr-tag" title={tag.hint}>{tag.text}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

// — Semester view
function AttemptBlock({ a, showTitle }: { a: ReportAttempt; showTitle: boolean }) {
  const total = a.subjects.length;
  return (
    <section className="rr-attempt" aria-label={`${a.batch.semester_name} result`}>
      {showTitle && <h3 className="rr-attempt-title">{a.batch.title}</h3>}
      <dl className="rr-stats">
        <Stat label="SGPA" value={gpa(a.sgpa)} primary />
        <Stat label="Passed" value={`${a.passed} of ${total}`} />
        <Stat label="Failed" value={String(a.failed)} alert={a.failed > 0} />
        <Stat label="Credits earned" value={fmt(a.credits_earned)} />
      </dl>
      <Ribbon subjects={a.subjects} />
      <SubjectList subjects={a.subjects} />
    </section>
  );
}

// — All-semesters view
function Ladder({ attempts, groups, onOpen }: { attempts: ReportAttempt[]; groups: SemesterGroup[]; onOpen: (code: string) => void }) {
  const multi = new Set(groups.filter((g) => g.attempts.length > 1).map((g) => g.code));
  return (
    <ol className="rr-ladder">
      {attempts.map((a) => (
        <li key={a.batch.id}>
          <button type="button" className="rr-ladder-row" onClick={() => onOpen(a.batch.semester_code)}>
            <span className="rr-ladder-sem">
              <strong>{a.batch.semester_name}</strong>
              {multi.has(a.batch.semester_code) && <small>{a.batch.title}</small>}
            </span>
            <span className="rr-ladder-sgpa" aria-label={`SGPA ${gpa(a.sgpa)}`}>
              <b>{gpa(a.sgpa)}</b>
              <i><u style={{ width: `${Math.max(0, Math.min(100, (a.sgpa ?? 0) * 10))}%` }} /></i>
            </span>
            <span className="rr-ladder-ribbon"><Ribbon subjects={a.subjects} /></span>
            <span className={`rr-ladder-count${a.failed > 0 ? " has-fail" : ""}`}>
              {a.failed > 0 ? `${a.failed} failed` : `${a.passed}/${a.subjects.length} passed`}
            </span>
            <span className="rr-ladder-go" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// — Till-now view
function TillNow({ report }: { report: StudentResultReport }) {
  const sm = report.summary;
  const failedRows = useMemo(() => {
    const rows = report.attempts.flatMap((a) =>
      a.subjects.filter((s) => s.status === "FAIL").map((s) => ({ s, a })),
    );
    // pending first: that is the exception worth reading
    return rows.sort((x, y) => Number(y.s.pending) - Number(x.s.pending));
  }, [report]);

  return (
    <section className="rr-attempt" aria-label="Results till now">
      <dl className="rr-stats">
        <Stat
          label="CGPA"
          value={gpa(sm.cgpa)}
          primary
          tag={sm.cgpa_computed ? { text: "Computed", hint: "Calculated from uploaded grade points and credits. The official university figure may differ." } : undefined}
        />
        <Stat label="Credits earned" value={fmt(sm.credits_earned)} />
        <Stat label="Subjects passed" value={String(sm.subjects_passed)} />
        <Stat label="Pending backlogs" value={String(sm.pending_backlogs.length)} alert={sm.pending_backlogs.length > 0} />
      </dl>
      <h3 className="rr-section">Failed attempts{failedRows.length ? ` (${failedRows.length})` : ""}</h3>
      {failedRows.length === 0 ? (
        <p className="rr-quiet">No failed subjects.</p>
      ) : (
        <ul className="rr-fails">
          {failedRows.map(({ s, a }, i) => (
            <li key={`${s.subject_code}-${a.batch.id}-${i}`} className={s.pending ? "is-pending" : "is-cleared"}>
              <div>
                <strong>{s.subject_name ?? s.subject_code}</strong>
                <small>{s.subject_code} · {a.batch.semester_name} · {a.batch.title}</small>
              </div>
              <span>{s.pending ? "Backlog pending" : `Cleared in ${s.cleared_in}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// — Report shell
export function ResultReport({ report }: { report: StudentResultReport }) {
  const groups = useMemo<SemesterGroup[]>(() => {
    const map = new Map<string, SemesterGroup>();
    for (const a of report.attempts) {
      const code = a.batch.semester_code;
      if (!map.has(code)) map.set(code, { code, name: a.batch.semester_name, attempts: [] });
      map.get(code)!.attempts.push(a);
    }
    return [...map.values()];
  }, [report]);

  const [scope, setScope] = useState<Scope>("semester");
  const [semCode, setSemCode] = useState<string>(groups.length ? groups[groups.length - 1].code : "");

  // — Keep the selected semester chip visible on narrow screens
  // WHY: the default is the latest semester, which sits at the END of a
  // horizontally scrolling row; without this the active chip starts off-screen.
  const semsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const box = semsRef.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (box && el) box.scrollLeft = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
  }, [semCode, scope]);

  const student = report.student;
  const active = groups.find((g) => g.code === semCode) ?? groups[groups.length - 1];

  if (!report.attempts.length) {
    return <p className="rr-quiet rr-empty">No published results for this student yet.</p>;
  }

  return (
    <div className="rr">
      <header className="rr-id">
        <div>
          <h2>{student?.name ?? "Student"}</h2>
          <p>{student?.roll_no ?? "—"} · {programmeLabel(student?.department)}</p>
        </div>
        <div className="rr-scope" role="tablist" aria-label="Report scope">
          {SCOPES.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={scope === o.key}
              onClick={() => setScope(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {scope === "semester" && groups.length > 1 && (
        <div className="rr-sems" role="tablist" aria-label="Semester" ref={semsRef}>
          {groups.map((g) => (
            <button
              key={g.code}
              type="button"
              role="tab"
              aria-selected={g.code === active.code}
              className="rr-sem"
              onClick={() => setSemCode(g.code)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {scope === "semester" && active && active.attempts.map((a) => (
        <AttemptBlock key={a.batch.id} a={a} showTitle={active.attempts.length > 1} />
      ))}
      {scope === "all" && (
        <Ladder attempts={report.attempts} groups={groups} onOpen={(code) => { setSemCode(code); setScope("semester"); }} />
      )}
      {scope === "till-now" && <TillNow report={report} />}
    </div>
  );
}
