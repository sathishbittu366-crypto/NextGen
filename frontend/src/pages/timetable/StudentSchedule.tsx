// Phone-first schedule for students: one day at a time, in the order the day happens.
// The week grid answers "what does the whole week look like"; on a phone the question is
// "what's my next class", so this view leads with today and marks what's on now / next.
import { useEffect, useMemo, useState } from "react";
import type { TimetableEntry, TimetablePeriod, TimetableRecord } from "../../api/timetable";


const DAYS = [
  ["MON", "Mon", "Monday"], ["TUE", "Tue", "Tuesday"], ["WED", "Wed", "Wednesday"],
  ["THU", "Thu", "Thursday"], ["FRI", "Fri", "Friday"], ["SAT", "Sat", "Saturday"],
] as const;

type Row = {
  entry: TimetableEntry;
  start: string;
  end: string;
  periodLabel: string;
  order: number;
};

const hhmm = (t: string) => t.slice(0, 5);
const toMinutes = (t: string) => {
  const [h, m] = hhmm(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** 0 = Monday … 6 = Sunday */
function todayIndex(now: Date) {
  return (now.getDay() + 6) % 7;
}

function titleOf(e: TimetableEntry) {
  return e.subject_name || e.custom_label || e.block_type.charAt(0) + e.block_type.slice(1).toLowerCase();
}

function metaOf(e: TimetableEntry) {
  return [e.subject_code, e.faculty_name, e.room].filter(Boolean).join(" · ");
}

function buildRows(record: TimetableRecord, dayKey: string): Row[] {
  const bySection = (s: TimetablePeriod["section"]) => record.periods.filter(p => p.section === s);
  const rows: Row[] = [];
  for (const entry of record.entries) {
    if (entry.day !== dayKey) continue;
    const list = bySection(entry.section);
    const first = list[entry.start_slot];
    const last = list[entry.start_slot + entry.duration - 1] || first;
    if (!first || !last) continue;
    const periodLabel = entry.duration > 1 && last !== first ? `P${first.label}–${last.label}` : `P${first.label}`;
    rows.push({ entry, start: hhmm(first.start), end: hhmm(last.end), periodLabel, order: toMinutes(first.start) });
  }
  return rows.sort((a, b) => a.order - b.order);
}

export function StudentSchedule({ record }: { record: TimetableRecord }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = todayIndex(now);
  // Sunday has no classes: open on Monday instead of an empty day.
  const [dayIdx, setDayIdx] = useState(today > 5 ? 0 : today);
  const [dayKey, , dayName] = DAYS[dayIdx];
  const isToday = dayIdx === today;

  const rows = useMemo(() => buildRows(record, dayKey), [record, dayKey]);
  const counts = useMemo(() => DAYS.map(([key]) => record.entries.filter(e => e.day === key).length), [record]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const currentIdx = isToday ? rows.findIndex(r => nowMin >= toMinutes(r.start) && nowMin < toMinutes(r.end)) : -1;
  const nextIdx = isToday ? rows.findIndex(r => toMinutes(r.start) > nowMin) : -1;

  // Lunch sits between the last morning class and the first afternoon class.
  const lunch = useMemo(() => {
    const m = record.periods.filter(p => p.section === "MORNING");
    const a = record.periods.filter(p => p.section === "AFTERNOON");
    if (!m.length || !a.length) return null;
    return { start: hhmm(m[m.length - 1].end), end: hhmm(a[0].start) };
  }, [record]);
  const firstAfternoon = rows.findIndex(r => r.entry.section === "AFTERNOON");
  const showLunch = lunch && firstAfternoon > 0;

  return (
    <div className="ss">
      <div className="ss-tabs" role="tablist" aria-label="Day of the week">
        {DAYS.map(([key, short, full], i) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`ss-tab-${key}`}
            aria-selected={i === dayIdx}
            aria-controls="ss-panel"
            aria-label={`${full}${i === today ? " (today)" : ""}`}
            className={`ss-tab${i === today ? " is-today" : ""}`}
            onClick={() => setDayIdx(i)}
          >
            {short}
            <i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div id="ss-panel" role="tabpanel" aria-labelledby={`ss-tab-${dayKey}`} className="ss-panel">
        <div className="ss-dayline">
          <strong>{dayName}</strong>
          <span>{isToday ? "Today · " : ""}{counts[dayIdx] === 0 ? "No classes" : `${counts[dayIdx]} ${counts[dayIdx] === 1 ? "class" : "classes"}`}</span>
        </div>

        {rows.length === 0 ? (
          <p className="ss-empty">Nothing scheduled on {dayName}.</p>
        ) : (
          <ol className="ss-list">
            {rows.map((r, i) => {
              const status = i === currentIdx ? "Now" : i === nextIdx && currentIdx === -1 ? "Next" : null;
              return (
                <li key={r.entry.id}>
                  {showLunch && i === firstAfternoon && (
                    <div className="ss-lunch"><span>Lunch</span><time>{lunch!.start}–{lunch!.end}</time></div>
                  )}
                  <div className={`ss-row${status === "Now" ? " is-now" : ""}`}>
                    <div className="ss-time">
                      <strong>{r.start}</strong>
                      <span>{r.end}</span>
                    </div>
                    <div className="ss-main">
                      <div className="ss-title">
                        {titleOf(r.entry)}
                        {r.entry.block_type === "LAB" && <em className="ss-chip">Lab</em>}
                        {status && <em className={`ss-chip is-${status.toLowerCase()}`}>{status}</em>}
                      </div>
                      <div className="ss-meta">{metaOf(r.entry) || "—"}</div>
                    </div>
                    <span className="ss-period" aria-label={`Period ${r.periodLabel.replace("P", "")}`}>{r.periodLabel}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
