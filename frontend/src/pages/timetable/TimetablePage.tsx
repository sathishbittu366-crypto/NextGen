import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ErrorPopup } from "../../components/ErrorPopup";
import { ToastPopup } from "../../components/ToastPopup";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import {
  getTimetables,
  saveTimetable,
  deleteTimetable,
  type TimetableBlockType,
  type TimetableEntry,
  type TimetableEntryInput,
  type TimetableFaculty,
  type TimetablePageData,
  type TimetablePeriod,
  type TimetableRecord,
  type TimetableSection,
  type TimetableSubject,
} from "../../api/timetable";
import { DaySchedulePanel } from "./DaySchedulePanel";
import "../../styles/ng-flat-controls.css";
import "./timetable.css";
import { ScheduleView } from "./ScheduleView";

interface Props { user: CurrentUser; onLoggedOut: () => void; }

type DraftEntry = TimetableEntryInput & {
  clientId: string;
  subject_code?: string | null;
  subject_name?: string | null;
  faculty_name?: string | null;
};

type AdminSectionFilter = "ALL" | string;

type BlockPaletteState = "closed" | "open";

const DAYS = [
  ["MON", "Mon"], ["TUE", "Tue"], ["WED", "Wed"], ["THU", "Thu"], ["FRI", "Fri"], ["SAT", "Sat"],
] as const;
const BLOCKS: Array<[TimetableBlockType, string]> = [
  ["THEORY", "Theory"], ["LAB", "Lab"], ["PE", "Professional Elective"], ["OE", "Open Elective"],
  ["TUTORIAL", "Tutorial"], ["ACTIVITY", "Activity"], ["OTHER", "Other"],
];
const BLOCK_LABELS: Record<TimetableBlockType, string> = Object.fromEntries(BLOCKS) as Record<TimetableBlockType, string>;

function toDraft(entry: TimetableEntry): DraftEntry {
  return {
    clientId: `existing-${entry.id}`,
    id: String(entry.id), day: entry.day, section: entry.section, start_slot: entry.start_slot, duration: entry.duration,
    block_type: entry.block_type, subject_id: entry.subject_id, custom_label: entry.custom_label,
    subject_code: entry.subject_code, subject_name: entry.subject_name,
    faculty_username: entry.faculty_username, faculty_name: entry.faculty_name, room: entry.room,
  };
}

function periodBySection(periods: TimetablePeriod[], section: TimetableSection) {
  return periods.filter(p => p.section === section);
}

function getSpanEntry(entries: DraftEntry[], day: string, section: TimetableSection, slot: number) {
  return entries.find(e => e.day === day && e.section === section && slot >= e.start_slot && slot < e.start_slot + e.duration);
}

function canPlace(entries: DraftEntry[], candidate: Pick<DraftEntry, "day" | "section" | "start_slot" | "duration">, ignoreId?: string) {
  return !entries.some(e => {
    if (e.clientId === ignoreId || e.day !== candidate.day || e.section !== candidate.section) return false;
    const a0 = e.start_slot, a1 = e.start_slot + e.duration;
    const b0 = candidate.start_slot, b1 = candidate.start_slot + candidate.duration;
    return a0 < b1 && b0 < a1;
  });
}

function recordLabel(record: TimetableRecord) {
  return `${record.semester_code} · Section ${record.section_name}`;
}

function statusLabel(status: TimetableRecord["status"]) {
  return status === "PUBLISHED" ? "Published" : "Draft";
}

function formatBlockTitle(entry: Pick<DraftEntry, "subject_code" | "subject_name" | "custom_label" | "block_type">) {
  if (entry.subject_code && entry.subject_name) return `${entry.subject_code} · ${entry.subject_name}`;
  return entry.custom_label || BLOCK_LABELS[entry.block_type];
}

export function TimetablePage({ user, onLoggedOut }: Props) {
  const isBuilderRole = user.role === "HOD" || user.role === "ADMIN";
  const isAdmin = user.role === "ADMIN";

  const [data, setData] = useState<TimetablePageData | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderReady, setBuilderReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Selected timetable for the read-only Admin experience.
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [adminSemesterFilter, setAdminSemesterFilter] = useState<number | "ALL">("ALL");
  const [adminSectionFilter, setAdminSectionFilter] = useState<AdminSectionFilter>("ALL");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<TimetableEntry | null>(null);

  // Builder state.
  const [semesterId, setSemesterId] = useState<number | "">("");
  const [sectionName, setSectionName] = useState("A");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [editing, setEditing] = useState<DraftEntry | null>(null);
  const [dragType, setDragType] = useState<TimetableBlockType | null>(null);
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorSubjects, setEditorSubjects] = useState<TimetableSubject[]>([]);
  const [editorFaculty, setEditorFaculty] = useState<TimetableFaculty[]>([]);
  const [paletteOpen, setPaletteOpen] = useState<BlockPaletteState>("closed");
  const [builderMenuOpen, setBuilderMenuOpen] = useState(false);

  const [viewerSemesterId, setViewerSemesterId] = useState<number | "">("");
  const [viewerSection, setViewerSection] = useState("ALL");

  async function load(params: Parameters<typeof getTimetables>[0] = {}) {
    setLoading(true); setError(null);
    try { setData(await getTimetables(params)); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Failed to load timetable"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const activePeriods = periods.length ? periods : (data?.periods_default || []);
  const morningPeriods = useMemo(() => periodBySection(activePeriods, "MORNING"), [activePeriods]);
  const afternoonPeriods = useMemo(() => periodBySection(activePeriods, "AFTERNOON"), [activePeriods]);

  const builderSelectedRecord = useMemo(
    () => data?.timetables.find(t => t.id === selectedRecordId) || null,
    [data, selectedRecordId],
  );

  const adminRecords = useMemo(() => {
    const records = data?.timetables || [];
    return records.filter(record => {
      const semesterMatch = adminSemesterFilter === "ALL" || record.semester_id === adminSemesterFilter;
      const sectionMatch = adminSectionFilter === "ALL" || record.section_name === adminSectionFilter;
      return semesterMatch && sectionMatch;
    });
  }, [adminSectionFilter, adminSemesterFilter, data]);

  const selectedAdminRecord = useMemo(() => {
    if (!adminRecords.length) return null;
    const exact = selectedRecordId ? adminRecords.find(record => record.id === selectedRecordId) : null;
    return exact || adminRecords.find(record => record.status === "PUBLISHED") || adminRecords[0];
  }, [adminRecords, selectedRecordId]);

  const adminSections = useMemo(
    () => Array.from(new Set((data?.timetables || []).map(record => record.section_name))).sort(),
    [data],
  );

  // Admin should land directly in the most useful existing timetable. Prefer a
  // published schedule, then any remaining timetable. Never default to the builder.
  useEffect(() => {
    if (!isAdmin || !data?.timetables.length || showBuilder) return;
    const candidate = selectedAdminRecord || data.timetables.find(record => record.status === "PUBLISHED") || data.timetables[0];
    if (candidate && candidate.id !== selectedRecordId) setSelectedRecordId(candidate.id);
  }, [data, isAdmin, selectedAdminRecord, selectedRecordId, showBuilder]);

  // HOD builder and Admin edit mode need the subject/faculty catalog for the selected semester.
  useEffect(() => {
    if (!isBuilderRole || !showBuilder || !semesterId) return;
    let cancelled = false;
    void getTimetables({ semester_id: Number(semesterId) }).then((fresh) => {
      if (cancelled) return;
      setEditorSubjects(fresh.subjects || []);
      setEditorFaculty(fresh.faculty || []);
      if (!periods.length) setPeriods(fresh.periods_default || []);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Failed to load timetable options");
    });
    return () => { cancelled = true; };
  // We intentionally only refresh the editor catalog when the active semester changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilderRole, showBuilder, semesterId]);

  useEffect(() => {
    if (!showBuilder || !builderSelectedRecord) return;
    setSemesterId(builderSelectedRecord.semester_id);
    setSectionName(builderSelectedRecord.section_name);
    setAcademicYear(builderSelectedRecord.academic_year);
    setPeriods(builderSelectedRecord.periods);
    setEntries(builderSelectedRecord.entries.map(toDraft));
    setEditing(null);
    setPaletteOpen("closed");
  }, [builderSelectedRecord, showBuilder]);

  useEffect(() => {
    if (!showBuilder || builderSelectedRecord) return;
    if (!semesterId && data?.semesters?.length) {
      const first = data.semesters.find(s => s.active) || data.semesters[0];
      setSemesterId(first.id);
    }
    if (!periods.length && data?.periods_default) setPeriods(data.periods_default);
  }, [builderSelectedRecord, data, periods.length, semesterId, showBuilder]);

  useEffect(() => {
    if (!data || isBuilderRole) return;
    const first = data.timetables[0];
    if (first && !viewerSemesterId) setViewerSemesterId(first.semester_id);
  }, [data, isBuilderRole, viewerSemesterId]);

  useEffect(() => {
    if (!adminSemesterFilter) setAdminSectionFilter("ALL");
  }, [adminSemesterFilter]);

  function enterEdit(record: TimetableRecord | null) {
    setAdminMenuOpen(false);
    setViewEntry(null);
    setShowBuilder(true);
    setBuilderReady(false);
    setPaletteOpen("closed");
    setEditing(null);
    setDragType(null);
    setDragEntryId(null);
    setBuilderMenuOpen(false);

    if (record) {
      setSelectedRecordId(record.id);
      setSemesterId(record.semester_id);
      setSectionName(record.section_name);
      setAcademicYear(record.academic_year);
      setPeriods(record.periods);
      setEntries(record.entries.map(toDraft));
    } else {
      setSelectedRecordId(null);
      setEntries([]);
      setPeriods(data?.periods_default || []);
      setSectionName("A");
      setAcademicYear("2026-27");
      setSemesterId("");
    }
    window.requestAnimationFrame(() => setBuilderReady(true));
  }

  function exitEdit() {
    setShowBuilder(false);
    setBuilderReady(false);
    setEditing(null);
    setPaletteOpen("closed");
    setDragType(null);
    setDragEntryId(null);
    setBuilderMenuOpen(false);
  }

  async function newDraftForSemester(nextSemester: number) {
    setSelectedRecordId(null);
    setSemesterId(nextSemester);
    setEntries([]);
    setPeriods(data?.periods_default || []);
    setSectionName("A");
    setAcademicYear("2026-27");
    setEditing(null);
    try {
      const fresh = await getTimetables({ semester_id: nextSemester });
      setEditorSubjects(fresh.subjects || []);
      setEditorFaculty(fresh.faculty || []);
      if (fresh.periods_default?.length) setPeriods(fresh.periods_default);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load semester options");
    }
  }

  function openRecord(record: TimetableRecord) {
    setSelectedRecordId(record.id);
    if (isAdmin && !showBuilder) return;
    setSemesterId(record.semester_id);
    setSectionName(record.section_name);
    setAcademicYear(record.academic_year);
    setPeriods(record.periods);
    setEntries(record.entries.map(toDraft));
    setEditing(null);
  }

  function subjectFor(entry: DraftEntry): TimetableSubject | undefined {
    if (entry.subject_id == null) return undefined;
    const source = showBuilder ? editorSubjects : (data?.subjects || []);
    const subject = source.find(s => s.id === entry.subject_id);
    if (subject) return subject;
    if (entry.subject_code || entry.subject_name) {
      return { id: entry.subject_id, code: entry.subject_code ?? "", name: entry.subject_name ?? "", has_lab: 0 };
    }
    return undefined;
  }

  function facultyFor(entry: DraftEntry): TimetableFaculty | undefined {
    if (!entry.faculty_username) return undefined;
    const source = showBuilder ? editorFaculty : (data?.faculty || []);
    const faculty = source.find(f => f.username === entry.faculty_username);
    if (faculty) return faculty;
    if (entry.faculty_name) return { username: entry.faculty_username, full_name: entry.faculty_name };
    return undefined;
  }

  function createEntry(type: TimetableBlockType, day = "MON", section: TimetableSection = "MORNING", slot = 0) {
    const candidate: DraftEntry = {
      clientId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      day, section, start_slot: slot, duration: 1, block_type: type, subject_id: null, custom_label: "", faculty_username: null, room: "",
    };
    if (!canPlace(entries, candidate)) { setError("That period is already occupied."); return; }
    setEntries(prev => [...prev, candidate]);
    setEditing(candidate);
    setPaletteOpen("closed");
    setDragType(null);
  }

  function handleSlotDrop(day: string, section: TimetableSection, slot: number) {
    if (dragType) {
      if (canPlace(entries, { day, section, start_slot: slot, duration: 1 })) createEntry(dragType, day, section, slot);
      else setError("That period is already occupied.");
      setDragType(null);
      return;
    }
    if (dragEntryId) {
      const moving = entries.find(e => e.clientId === dragEntryId);
      if (!moving) return;
      if (!canPlace(entries, { day, section, start_slot: slot, duration: moving.duration }, moving.clientId)) {
        setError("That move would overlap another block.");
        return;
      }
      setEntries(prev => prev.map(e => e.clientId === dragEntryId ? { ...e, day, section, start_slot: slot } : e));
      setDragEntryId(null);
    } else if (showBuilder && !getSpanEntry(entries, day, section, slot)) {
      if (paletteOpen === "open") setDragType(null);
    }
  }

  function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.clientId !== id));
    if (editing?.clientId === id) setEditing(null);
  }

  function updateEditing(patch: Partial<DraftEntry>) {
    if (!editing) return;
    setEditing(prev => prev ? { ...prev, ...patch } : prev);
    setEntries(prev => prev.map(e => e.clientId === editing.clientId ? { ...e, ...patch } : e));
  }

  function changeDuration(raw: number) {
    if (!editing) return;
    const count = periodBySection(activePeriods, editing.section).length;
    const next = Math.max(1, Math.min(raw, count - editing.start_slot));
    const candidate = { day: editing.day, section: editing.section, start_slot: editing.start_slot, duration: next } as const;
    if (!canPlace(entries, candidate, editing.clientId)) { setError("That length overlaps another block."); return; }
    updateEditing({ duration: next });
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    if (!semesterId) { setError("Select a semester first."); return; }
    if (!sectionName.trim()) { setError("Section is required."); return; }

    const currentLabel = builderSelectedRecord ? recordLabel(builderSelectedRecord) : `${data?.semesters.find(s => s.id === Number(semesterId))?.code || "Timetable"} · Section ${sectionName.trim().toUpperCase()}`;
    if (status === "PUBLISHED") {
      const confirmed = window.confirm(
        `${currentLabel} will be published to faculty and students. Continue?`,
      );
      if (!confirmed) return;
    } else if (builderSelectedRecord?.status === "PUBLISHED") {
      const confirmed = window.confirm(
        `Saving ${currentLabel} as a draft will remove its current published state. Continue?`,
      );
      if (!confirmed) return;
    }

    setSaving(true); setError(null);
    try {
      const result = await saveTimetable({
        id: selectedRecordId,
        semester_id: Number(semesterId),
        section_name: sectionName.trim().toUpperCase(),
        academic_year: academicYear.trim(),
        periods: activePeriods,
        entries,
        status,
      });
      setSelectedRecordId(result.timetable.id);
      setNotice(status === "PUBLISHED" ? "Timetable published for faculty and students." : "Timetable draft saved.");
      await load();
      setShowBuilder(false);
      setBuilderReady(false);
      setEditing(null);
      setPaletteOpen("closed");
      setBuilderMenuOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save timetable");
    } finally { setSaving(false); }
  }

  async function removeCurrent() {
    if (!selectedRecordId) return;
    const record = data?.timetables.find(item => item.id === selectedRecordId);
    const label = record ? recordLabel(record) : "this timetable";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteTimetable(selectedRecordId);
      setNotice("Timetable deleted.");
      setSelectedRecordId(null);
      setEntries([]);
      setShowBuilder(false);
      await load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Could not delete timetable"); }
  }

  function buildCellBlock(entry: DraftEntry, readonly: boolean) {
    const title = formatBlockTitle(entry);
    return (
      <button
        type="button"
        key={entry.clientId}
        className={`tt-block${!readonly && editing?.clientId === entry.clientId ? " tt-selected" : ""}`}
        data-type={entry.block_type}
        style={{ gridColumn: `${entry.start_slot + 1} / span ${entry.duration}` }}
        draggable={!readonly}
        onDragStart={readonly ? undefined : () => setDragEntryId(entry.clientId)}
        onDragEnd={readonly ? undefined : () => setDragEntryId(null)}
        onClick={(event) => {
          event.stopPropagation();
          if (readonly) {
            setViewEntry(entry as TimetableEntry);
          } else {
            setEditing(entry);
          }
        }}
        title={title}
      >
        <span className="tt-block-title">{title}</span>
      </button>
    );
  }

  function renderTimetableGrid(record: TimetableRecord, readonly = true) {
    const sourcePeriods = record.periods;
    const sourceEntries = readonly && record ? record.entries.map(toDraft) : entries;

    return (
      <div className="tt-grid">
        <div className="tt-grid-header">
          <div className="tt-day-head">Day</div>
          <div className="tt-slot-group">
            {periodBySection(sourcePeriods, "MORNING").map(p => <div key={p.key} className="tt-slot-head"><strong>{p.label}</strong><span>{p.start}–{p.end}</span></div>)}
          </div>
          <div className="tt-break-strip"><span>LUNCH</span></div>
          <div className="tt-slot-group afternoon">
            {periodBySection(sourcePeriods, "AFTERNOON").map(p => <div key={p.key} className="tt-slot-head"><strong>{p.label}</strong><span>{p.start}–{p.end}</span></div>)}
          </div>
        </div>
        {DAYS.map(([day, label]) => {
          const recordDay = day;
          const renderDaySection = (section: TimetableSection, count: number) => {
            const sectionEntries = sourceEntries.filter(e => e.day === recordDay && e.section === section);
            const slots = Array.from({ length: count }, (_, slot) => slot);
            return (
              <div className={`tt-slot-area ${section === "MORNING" ? "morning" : "afternoon"}`}>
                <div className="tt-slot-grid" aria-hidden="true">
                  {slots.map(slot => {
                    const occupied = Boolean(getSpanEntry(sourceEntries, recordDay, section, slot));
                    return (
                      <div
                        key={`${recordDay}-${section}-${slot}`}
                        className={`tt-slot${!readonly && occupied ? " is-occupied" : ""}`}
                        onDragOver={readonly ? undefined : (event) => { event.preventDefault(); event.currentTarget.classList.add("drop-ready"); }}
                        onDragLeave={readonly ? undefined : (event) => event.currentTarget.classList.remove("drop-ready")}
                        onDrop={readonly ? undefined : (event) => { event.preventDefault(); event.currentTarget.classList.remove("drop-ready"); handleSlotDrop(recordDay, section, slot); }}
                        onClick={readonly ? undefined : () => handleSlotDrop(recordDay, section, slot)}
                        aria-label={!readonly && !occupied ? `${label} ${periodBySection(sourcePeriods, section)[slot]?.label || "period"}` : undefined}
                      >
                        {!readonly && !occupied && <span className="tt-slot-add" aria-hidden="true">+</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="tt-block-layer">
                  {sectionEntries.map(entry => buildCellBlock(entry, readonly))}
                </div>
              </div>
            );
          };
          return (
            <div className="tt-day-row" key={day}>
              <div className="tt-day-label"><strong>{label}</strong><span>{day}</span></div>
              {renderDaySection("MORNING", periodBySection(sourcePeriods, "MORNING").length)}
              <div className="tt-break-strip"><span>LUNCH</span></div>
              {renderDaySection("AFTERNOON", periodBySection(sourcePeriods, "AFTERNOON").length)}
            </div>
          );
        })}
      </div>
    );
  }

  function renderReadonlyGrid(record: TimetableRecord) {
    return <div className="tt-table-frame"><div className="tt-scroll"><div className="tt-grid-shell">{renderTimetableGrid(record, true)}</div></div></div>;
  }

  function renderEditGrid() {
    const draftRecord: TimetableRecord = {
      id: selectedRecordId ?? 0,
      semester_id: Number(semesterId || 0),
      semester_code: data?.semesters.find(s => s.id === Number(semesterId))?.code || "",
      semester_name: data?.semesters.find(s => s.id === Number(semesterId))?.name || "",
      section_name: sectionName || "A",
      academic_year: academicYear,
      hod_username: user.username,
      status: builderSelectedRecord?.status || "DRAFT",
      periods: activePeriods,
      entries: entries.map(entry => ({
        id: Number(entry.id || 0), day: entry.day, section: entry.section, start_slot: entry.start_slot,
        duration: entry.duration, block_type: entry.block_type, subject_id: entry.subject_id,
        subject_code: entry.subject_code ?? subjectFor(entry)?.code ?? null,
        subject_name: entry.subject_name ?? subjectFor(entry)?.name ?? null,
        custom_label: entry.custom_label, faculty_username: entry.faculty_username,
        faculty_name: entry.faculty_name ?? facultyFor(entry)?.full_name ?? null, room: entry.room,
      })),
    };
    return <div className="tt-table-frame tt-edit-frame"><div className="tt-scroll"><div className="tt-grid-shell">{renderTimetableGrid(draftRecord, false)}</div></div></div>;
  }

  const adminHeaderRecord = selectedAdminRecord;
  const adminStatus = adminHeaderRecord?.status || "DRAFT";

  if (loading) {
    return <AppShell user={user} activeNav="timetable" heading={isAdmin ? "Timetable" : "Timetable"} onLoggedOut={onLoggedOut}><p className="empty-note">Loading timetable…</p></AppShell>;
  }

  if ((user.role === "HOD" || user.role === "FACULTY") && !showBuilder) {
    return <AppShell user={user} activeNav="timetable" heading="Schedule" onLoggedOut={onLoggedOut}><ScheduleView user={user} onManage={() => setShowBuilder(true)} /></AppShell>;
  }

  if (!isBuilderRole) {
    const records = (data?.timetables || []).filter(t => viewerSection === "ALL" || t.section_name === viewerSection);
    const viewer = records.find(t => t.semester_id === viewerSemesterId) || records[0] || null;
    return <AppShell user={user} activeNav="timetable" heading="Timetable" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}
      <div className="timetable-page timetable-viewer-page">
        <div className="tt-public-head">
          <div><span className="tt-eyebrow">Academic schedule</span><h2>Class timetable</h2><p>Published schedule for your current academic context.</p></div>
          <div className="tt-viewer-selects"><select value={viewerSemesterId} onChange={e => { setViewerSemesterId(Number(e.target.value)); void load({ semester_id: Number(e.target.value) }); }}><option value="">Select semester</option>{data?.semesters.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}</select><select value={viewerSection} onChange={e => setViewerSection(e.target.value)}><option value="ALL">All sections</option>{Array.from(new Set((data?.timetables || []).map(t => t.section_name))).sort().map(s => <option key={s} value={s}>Section {s}</option>)}</select></div>
        </div>
        {!viewer && <div className="tt-empty">No published timetable is available for this selection yet.</div>}
        {viewer && <div className="tt-read-surface"><div className="tt-read-context"><div><strong>{recordLabel(viewer)}</strong><span>{viewer.academic_year}</span></div><span className="tt-badge published">PUBLISHED</span></div>{renderReadonlyGrid(viewer)}</div>}
      </div>
    </AppShell>;
  }

  // ----------------------------- ADMIN: VIEW MODE -----------------------------
  if (isAdmin && !showBuilder) {
    return <AppShell user={user} activeNav="timetable" heading="Timetable" onLoggedOut={onLoggedOut}>
      <ErrorPopup message={error} onClose={() => setError(null)} />
      {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}
      <div className="timetable-page tt-admin-page">
        <header className="tt-admin-intro">
          <div>
            <span className="tt-eyebrow">Academic operations</span>
            <h2>Timetable management</h2>
          </div>
          <div className="tt-admin-actions">
            <button type="button" className="ng-flat-btn ng-flat-btn-primary" onClick={() => enterEdit(null)}>+ New timetable</button>
            <div className="tt-menu-wrap">
              <button type="button" className="tt-icon-action" onClick={() => setAdminMenuOpen(v => !v)} aria-label="More timetable actions" aria-expanded={adminMenuOpen}>•••</button>
              {adminMenuOpen && (
                <>
                  <button type="button" className="tt-popover-dismiss" aria-label="Close menu" onClick={() => setAdminMenuOpen(false)} />
                  <div className="tt-admin-menu" role="menu">
                    {adminHeaderRecord && <button type="button" role="menuitem" onClick={() => enterEdit(adminHeaderRecord)}>Edit timetable</button>}
                    {adminHeaderRecord?.status === "DRAFT" && <button type="button" role="menuitem" onClick={() => enterEdit(adminHeaderRecord)}>Review & publish</button>}
                    {adminHeaderRecord && <button type="button" role="menuitem" className="danger" onClick={() => { setAdminMenuOpen(false); void removeCurrent(); }}>Delete timetable</button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="tt-admin-context" aria-label="Timetable selection">
          <label>
            <span>Semester</span>
            <select value={adminSemesterFilter} onChange={e => { const value = e.target.value; setAdminSemesterFilter(value === "ALL" ? "ALL" : Number(value)); setAdminSectionFilter("ALL"); }}>
              <option value="ALL">All semesters</option>
              {data?.semesters.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </label>
          <label>
            <span>Section</span>
            <select value={adminSectionFilter} onChange={e => setAdminSectionFilter(e.target.value)}>
              <option value="ALL">All sections</option>
              {adminSections.map(section => <option key={section} value={section}>Section {section}</option>)}
            </select>
          </label>
          <div className="tt-context-status">
            <span>{adminRecords.length} {adminRecords.length === 1 ? "timetable" : "timetables"}</span>
            <span>·</span>
            <span>View mode</span>
          </div>
        </section>

        {adminRecords.length > 1 && (
          <section className="tt-admin-switcher">
            <div className="tt-switcher-label">Timetables</div>
            <div className="tt-switcher-list" role="tablist" aria-label="Available timetables">
              {adminRecords.map(record => (
                <button key={record.id} type="button" className={`tt-switcher-item${record.id === adminHeaderRecord?.id ? " active" : ""}`} onClick={() => setSelectedRecordId(record.id)} role="tab" aria-selected={record.id === adminHeaderRecord?.id}>
                  <span><strong>{recordLabel(record)}</strong><small>{record.academic_year}</small></span>
                  <span className={`tt-badge ${record.status === "PUBLISHED" ? "published" : "draft"}`}>{statusLabel(record.status)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!adminHeaderRecord && (
          <section className="tt-admin-empty">
            <div className="tt-empty-icon" aria-hidden="true">＋</div>
            <span className="tt-eyebrow">No timetable yet</span>
            <h3>Create the first schedule</h3>
            <button type="button" className="ng-flat-btn ng-flat-btn-primary" onClick={() => enterEdit(null)}>Create timetable</button>
          </section>
        )}

        {adminHeaderRecord && (
          <section className="tt-admin-surface">
            <div className="tt-admin-surface-head">
              <div>
                <div className="tt-admin-record-line"><strong>{recordLabel(adminHeaderRecord)}</strong><span>·</span><span>{adminHeaderRecord.academic_year}</span></div>
              </div>
              <span className={`tt-badge ${adminStatus === "PUBLISHED" ? "published" : "draft"}`}>{statusLabel(adminStatus)}</span>
            </div>
            {renderReadonlyGrid(adminHeaderRecord)}
            <div className="tt-admin-surface-footer">
              <button type="button" className="tt-inline-edit" onClick={() => enterEdit(adminHeaderRecord)}>Edit timetable</button>
            </div>
          </section>
        )}
      </div>

      {viewEntry && (
        <div className="tt-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setViewEntry(null); }}>
          <section className="tt-detail-modal" role="dialog" aria-modal="true" aria-labelledby="tt-detail-title">
            <div className="tt-modal-head"><div><span className="tt-eyebrow">Timetable entry</span><h3 id="tt-detail-title">{formatBlockTitle(viewEntry)}</h3><p>{viewEntry.day} · {viewEntry.section === "MORNING" ? "Morning" : "Afternoon"}</p></div><button type="button" className="tt-icon-btn" onClick={() => setViewEntry(null)} aria-label="Close">×</button></div>
            <div className="tt-detail-grid">
              <div><span>Period</span><strong>{adminHeaderRecord?.periods.filter(p => p.section === viewEntry.section).slice(viewEntry.start_slot, viewEntry.start_slot + viewEntry.duration).map(p => p.label).join(" → ") || "—"}</strong></div>
              <div><span>Type</span><strong>{BLOCK_LABELS[viewEntry.block_type]}</strong></div>
              <div><span>Faculty</span><strong>{viewEntry.faculty_name || "Not assigned"}</strong></div>
              <div><span>Room</span><strong>{viewEntry.room || "Not assigned"}</strong></div>
            </div>
            <div className="tt-modal-actions"><button type="button" className="ng-flat-btn ng-flat-btn-outline" onClick={() => setViewEntry(null)}>Close</button></div>
          </section>
        </div>
      )}
    </AppShell>;
  }

  // ----------------------------- BUILDER: HOD + ADMIN EDIT MODE -----------------------------
  const activeBuilderRecord = builderSelectedRecord;
  return <AppShell user={user} activeNav="timetable" heading={isAdmin ? "Edit timetable" : "Timetable builder"} onLoggedOut={onLoggedOut}>
    <ErrorPopup message={error} onClose={() => setError(null)} />
    {notice && <ToastPopup type="success" message={notice} onClose={() => setNotice(null)} />}
    <div className={`timetable-page tt-builder-page${builderReady ? " is-ready" : ""}`}>
      <header className="tt-builder-head">
        <div>
          <nav className="tt-breadcrumb" aria-label="Breadcrumb">
            <span className="tt-breadcrumb-chevron" aria-hidden="true">‹</span>
            <button type="button" onClick={exitEdit}>Timetable</button>
            <span aria-hidden="true">/</span>
            <span>Edit timetable</span>
          </nav>
          <h2>{activeBuilderRecord ? recordLabel(activeBuilderRecord) : "New timetable"}</h2>
          <div className="tt-builder-subline">
            <span>{activeBuilderRecord?.academic_year || academicYear}</span>
            {activeBuilderRecord && <span className={`tt-badge ${activeBuilderRecord.status === "PUBLISHED" ? "published" : "draft"}`}>{statusLabel(activeBuilderRecord.status)}</span>}
            {isAdmin && activeBuilderRecord?.status === "PUBLISHED" && <span className="tt-edit-mode-chip">EDIT MODE</span>}
          </div>
        </div>
        <div className="tt-builder-actions">
          <button type="button" className="ng-flat-btn ng-flat-btn-outline" disabled={saving} onClick={() => void save("DRAFT")}>{saving ? "Saving…" : "Save draft"}</button>
          <button type="button" className="ng-flat-btn ng-flat-btn-primary" disabled={saving} onClick={() => void save("PUBLISHED")}>{saving ? "Publishing…" : "Publish"}</button>
          {selectedRecordId && <div className="tt-menu-wrap">
            <button type="button" className="tt-icon-action" onClick={() => setBuilderMenuOpen(v => !v)} aria-label="More edit actions" aria-expanded={builderMenuOpen}>•••</button>
            {builderMenuOpen && (
              <>
                <button type="button" className="tt-popover-dismiss" aria-label="Close menu" onClick={() => setBuilderMenuOpen(false)} />
                <div className="tt-admin-menu" role="menu">
                  <button type="button" role="menuitem" className="danger" onClick={() => { setBuilderMenuOpen(false); void removeCurrent(); }}>Delete timetable</button>
                </div>
              </>
            )}
          </div>}
        </div>
      </header>

      {user.role === "HOD" && <DaySchedulePanel faculty={editorFaculty} onNotice={setNotice} />}

      <section className="tt-builder-context" aria-label="Timetable details">
        <label className="tt-field"><span>Semester</span><select value={semesterId} disabled={Boolean(activeBuilderRecord)} onChange={e => void newDraftForSemester(Number(e.target.value))}><option value="">Choose semester</option>{data?.semesters.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></label>
        <label className="tt-field"><span>Section</span><input value={sectionName} onChange={e => setSectionName(e.target.value)} maxLength={32} /></label>
        <label className="tt-field"><span>Academic year</span><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} maxLength={32} /></label>
      </section>

      <section className="tt-editor-tools">
        <button type="button" className={`tt-add-class ${paletteOpen === "open" ? "active" : ""}`} onClick={() => setPaletteOpen(paletteOpen === "open" ? "closed" : "open")}>
          <span>＋</span> Add class
        </button>
        <div className="tt-editor-summary"><strong>{entries.length}</strong><span>scheduled blocks</span></div>
      </section>

      {paletteOpen === "open" && (
        <section className="tt-palette-panel" aria-label="Add timetable block">
          <div className="tt-palette-copy"><strong>Choose class type</strong></div>
          <div className="tt-palette-list">{BLOCKS.map(([type, label]) => <button key={type} type="button" draggable onDragStart={() => setDragType(type)} onClick={() => setDragType(type)} className={`tt-palette-item${dragType === type ? " selected" : ""}`}><span>{label}</span><small>＋</small></button>)}</div>
        </section>
      )}

      {activeBuilderRecord || semesterId ? renderEditGrid() : (
        <div className="tt-admin-empty tt-builder-empty"><span className="tt-eyebrow">Start here</span><h3>Select a semester</h3></div>
      )}
    </div>

    {editing && (
      <div className="tt-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null); }}>
        <section className="tt-modal" role="dialog" aria-modal="true" aria-labelledby="configure-block-title">
          <div className="tt-modal-head">
            <div><span className="tt-eyebrow">Edit class</span><h3 id="configure-block-title">Configure timetable entry</h3><p>{editing.day} · {editing.section === "MORNING" ? "Morning" : "Afternoon"} · period {editing.start_slot + 1}</p></div>
            <button type="button" className="tt-icon-btn" onClick={() => setEditing(null)} aria-label="Close">×</button>
          </div>
          <div className="tt-modal-body">
            <div className="tt-modal-grid">
              <div className="tt-field"><span>Type</span><select value={editing.block_type} onChange={e => updateEditing({ block_type: e.target.value as TimetableBlockType })}>{BLOCKS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select></div>
              <div className="tt-field"><span>Duration</span><select value={editing.duration} onChange={e => changeDuration(Number(e.target.value))}>{Array.from({ length: periodBySection(activePeriods, editing.section).length - editing.start_slot }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "period" : "periods"}</option>)}</select></div>
              <div className="tt-field"><span>Subject</span><select value={editing.subject_id ?? ""} onChange={e => updateEditing({ subject_id: e.target.value ? Number(e.target.value) : null, custom_label: e.target.value ? "" : editing.custom_label })}><option value="">Custom / no subject</option>{editorSubjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></div>
              <div className="tt-field"><span>Faculty</span><select value={editing.faculty_username ?? ""} onChange={e => updateEditing({ faculty_username: e.target.value || null })}><option value="">Not assigned</option>{editorFaculty.map(f => <option key={f.username} value={f.username}>{f.full_name || f.username}</option>)}</select></div>
              <div className="tt-field"><span>Room</span><input value={editing.room} onChange={e => updateEditing({ room: e.target.value })} placeholder="e.g. Lab 2" /></div>
              <div className="tt-field"><span>Custom label</span><input value={editing.custom_label} onChange={e => updateEditing({ custom_label: e.target.value })} placeholder="Used for activities / labels" /></div>
            </div>
            <div className="tt-help">Edits remain local until you save the draft or publish. Moving or resizing a class never permits an overlap.</div>
            <div className="tt-modal-actions"><button type="button" className="ng-flat-btn ng-flat-btn-outline tt-secondary-danger" onClick={() => removeEntry(editing.clientId)}>Remove class</button><button type="button" className="ng-flat-btn ng-flat-btn-primary" onClick={() => setEditing(null)}>Done</button></div>
          </div>
        </section>
      </div>
    )}
  </AppShell>;
}
