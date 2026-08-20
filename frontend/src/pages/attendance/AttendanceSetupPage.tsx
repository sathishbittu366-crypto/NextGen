// Group 3 — Mark Attendance: Setup screen.
// Mirrors webapp/routes/attendance.py's attendance_setup() + the old
// /attendance/subjects-for-semester HTMX partial, ported to one JSON call
// (GET /api/attendance/setup) plus a refetch on semester change
// (GET /api/attendance/subjects?semester_id=).
//
// Flow: semester picker -> subject picker (refetches on semester change) ->
// date, session type (Class/Lab), duration, topic -> Open button
// (POST /api/attendance/sessions) -> navigate to the register screen with
// the returned session id.
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  type SemesterOption,
  type SubjectOption,
  type SessionType,
  type MonthlyAttendanceRegister,
  getSetup,
  getSubjectsForSemester,
  getMonthlyRegister,
  monthlyRegisterPdfUrl,
  openSession,
} from "../../api/attendance";
import { getDashboard, type SessionRow } from "../../api/dashboard";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import { AppShell } from "../../components/AppShell";

interface AttendanceSetupPageProps {
  user: CurrentUser;
  onLoggedOut: () => void;
}

export function AttendanceSetupPage({ user, onLoggedOut }: AttendanceSetupPageProps) {
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const [semesters, setSemesters]     = useState<SemesterOption[]>([]);
  const [subjects, setSubjects]       = useState<SubjectOption[]>([]);

  const [semesterId, setSemesterId]   = useState<number | null>(null);
  const [subjectId, setSubjectId]     = useState<number | null>(null);
  const [attendanceDate, setAttendanceDate] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("CLASS");
  const [durationHours, setDurationHours]   = useState(1);
  const [topic, setTopic]             = useState("");

  // Semester view history list
  const [semesterSessions, setSemesterSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions]   = useState(false);

  // — Load semester session history helper
  const loadSemesterHistory = useCallback(async (semId: number) => {
    setLoadingSessions(true);
    try {
      const dash = await getDashboard(undefined, semId);
      if (dash.role === "HOD" && dash.days) {
        const allRows = Object.values(dash.days).flat();
        setSemesterSessions(allRows);
      }
    } catch {
      setSemesterSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // — InitialLoad
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSetup();
        setSemesters(res.semesters);
        setSubjects(res.subjects);
        const defSem = res.default_semester_id ?? res.semesters[0]?.id ?? null;
        setSemesterId(defSem);
        setSubjectId(res.subjects[0]?.id ?? null);
        setAttendanceDate(res.today);
        if (defSem) {
          loadSemesterHistory(defSem);
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load setup data");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSemesterHistory]);

  // — SemesterChange: refetch subjects + semester history
  const handleSemesterChange = useCallback(async (newSemId: number | null) => {
    setSemesterId(newSemId);
    setSubjectId(null);
    setSemesterSessions([]);
    if (!newSemId) {
      setSubjects([]);
      return;
    }
    try {
      const res = await getSubjectsForSemester(newSemId);
      setSubjects(res.subjects);
      setSubjectId(res.subjects[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load subjects");
    }
    loadSemesterHistory(newSemId);
  }, [loadSemesterHistory]);

  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? null;
  const selectedSemester = semesters.find((s) => s.id === semesterId) ?? null;

  // Lock duration to 3 hours for LAB sessions
  useEffect(() => {
    if (sessionType === "LAB") {
      setDurationHours(3);
    }
  }, [sessionType]);

  // — Monthly Attendance Register state
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [register, setRegister] = useState<MonthlyAttendanceRegister | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [selectedGridDate, setSelectedGridDate] = useState<string | null>(null);

  const [regYear, regMonthNum] = useMemo(() => {
    const parts = month.split("-").map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [month]);

  useEffect(() => {
    if (!semesterId || !subjectId || !regYear || !regMonthNum) {
      setRegister(null);
      return;
    }
    let cancelled = false;
    setLoadingRegister(true);
    setRegisterError(null);
    getMonthlyRegister({
      semesterId,
      subjectId,
      year: regYear,
      month: regMonthNum,
    })
      .then((data) => {
        if (!cancelled) setRegister(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setRegister(null);
          setRegisterError(err instanceof ApiClientError ? err.message : "Failed to load monthly register");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRegister(false);
      });
    return () => {
      cancelled = true;
    };
  }, [semesterId, subjectId, regYear, regMonthNum]);

  const printPdfUrl = (register && semesterId && subjectId)
    ? monthlyRegisterPdfUrl({ semesterId, subjectId, year: regYear, month: regMonthNum })
    : "";

  const selectedDayInfo = register?.days.find((d) => d.date === selectedGridDate) ?? null;

  // — OpenSession
  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    if (!semesterId || !subjectId || !attendanceDate || !topic.trim()) {
      setError("Enter today's topic / lecture notes.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await openSession({
        attendance_date: attendanceDate,
        semester_id: semesterId,
        subject_id: subjectId,
        session_type: sessionType,
        duration_hours: durationHours,
        topic,
      });
      navigate(`/attendance/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to open session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user} activeNav="attendance" heading="Mark Student Attendance" onLoggedOut={onLoggedOut}>
      {loading && <div className="empty-note">Loading attendance setup data…</div>}
      {error && <div className="login-error">{error}</div>}

      {!loading && (
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Main Setup Card ── */}
          <div style={{
            background: "var(--card-glass)",
            border: "1.5px solid var(--border)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)"
          }}>
            {/* Card header strip */}
            <div style={{
              background: "linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(37, 99, 235, 0.12) 100%)",
              borderBottom: "1px solid var(--border)",
              padding: "22px 28px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: "linear-gradient(135deg, #0284c7, #2563eb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, color: "#fff",
                boxShadow: "0 8px 24px rgba(56, 189, 248, 0.4)",
                flexShrink: 0,
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="8" y1="14" x2="8" y2="14"/>
                  <line x1="12" y1="14" x2="12" y2="14"/>
                </svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Open Attendance Session</h2>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                  Select semester, subject, session type &amp; date to launch attendance register.
                </p>
              </div>
            </div>

            <div style={{ padding: "28px" }}>
              <form onSubmit={handleOpen}>
                {/* Row 1: Semester + Subject */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginBottom: 4 }}>

                  <div className="field">
                    <label htmlFor="semester-select">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
                        Semester *
                      </span>
                    </label>
                    <select
                      id="semester-select"
                      className="input-field"
                      value={semesterId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleSemesterChange(val ? Number(val) : null);
                      }}
                    >
                      <option value="">— Select Semester —</option>
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="subject-select">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        Subject *
                      </span>
                    </label>
                    <select
                      id="subject-select"
                      className="input-field"
                      value={subjectId ?? ""}
                      onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
                      disabled={subjects.length === 0}
                    >
                      {subjects.length === 0 ? (
                        <option value="">No subjects for this semester</option>
                      ) : (
                        <>
                          <option value="">— Select Subject —</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Session Type Pills */}
                <div className="field" style={{ marginBottom: 20 }}>
                  <label>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      Session Type *
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[
                      { type: "CLASS", label: "Regular Class", sub: "Theory — 1 hour", icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      )},
                      { type: "LAB", label: "Lab Session", sub: "Fixed · 3 Hours", icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-5 5h16l-5-5V3"/></svg>
                      )},
                    ].map(({ type, label, sub, icon }) => {
                      const isLab = type === "LAB";
                      const disabled = false;
                      const active = sessionType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSessionType(type as "CLASS" | "LAB");
                            setDurationHours(isLab ? 3 : 1);
                          }}
                          style={{
                            flex: 1,
                            padding: "14px 18px",
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.45 : 1,
                            border: active ? "2px solid var(--heading-accent)" : "1.5px solid var(--border)",
                            background: active
                              ? "linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(37, 99, 235, 0.12))"
                              : "var(--chip-bg-muted)",
                            color: "var(--text)",
                            boxShadow: active
                              ? "0 0 0 3px rgba(56, 189, 248, 0.18), 0 8px 24px rgba(56, 189, 248, 0.15)"
                              : "0 2px 6px rgba(0,0,0,0.06)",
                            transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            textAlign: "left",
                          }}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: active ? "linear-gradient(135deg, #0284c7, #2563eb)" : "var(--bg)",
                            color: active ? "#fff" : "var(--muted)",
                            boxShadow: active ? "0 4px 12px rgba(56,189,248,0.3)" : "none",
                            transition: "all 0.22s ease",
                          }}>
                            {icon}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: active ? "var(--heading-accent)" : "var(--text)" }}>{label}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>{sub}</div>
                          </div>
                          {active && (
                            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--heading-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 2: Date + Duration */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginBottom: 4 }}>
                  <div className="field">
                    <label htmlFor="date-input">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Attendance Date *
                      </span>
                    </label>
                    <input
                      id="date-input"
                      type="date"
                      className="input-field"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="duration-input">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Duration (Hours) {sessionType === "LAB" ? "· Fixed 3h for Lab" : "*"}
                      </span>
                    </label>
                    <input
                      id="duration-input"
                      type="number"
                      className="input-field"
                      min={1}
                      max={8}
                      value={sessionType === "LAB" ? 3 : durationHours}
                      disabled={sessionType === "LAB"}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      style={{
                        background: sessionType === "LAB" ? "rgba(2, 132, 199, 0.08)" : undefined,
                        borderColor: sessionType === "LAB" ? "var(--heading-accent)" : undefined,
                        color: sessionType === "LAB" ? "var(--heading-accent)" : undefined,
                        fontWeight: 800,
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Topic */}
                <div className="field" style={{ marginBottom: 28 }}>
                  <label htmlFor="topic-input">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Topic / Lecture Notes *
                    </span>
                  </label>
                  <input
                    id="topic-input"
                    type="text"
                    className="input-field"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Binary Search Trees &amp; AVL Trees (Required)"
                    required
                  />
                </div>

                {/* Submit button */}
                <button
                  id="open-session-btn"
                  type="submit"
                  className="btn btn-block"
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #0284c7 0%, #1d4ed8 60%, #2563eb 100%)",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 16,
                    border: "none",
                    boxShadow: "0 12px 32px rgba(56, 189, 248, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                    cursor: "pointer",
                    letterSpacing: "-0.01em",
                    transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                  disabled={submitting || !semesterId || !subjectId || !attendanceDate || !topic.trim()}
                >
                  {submitting ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                      Opening Session Register…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Open Attendance Register
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>


          {/* ── Monthly Attendance Register Grid Card ── */}
          <div
            className="card card-pad"
            style={{
              background: "var(--card-glass)",
              border: "1.5px solid var(--border)",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Header & Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "linear-gradient(135deg, #059669, #10b981)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 20,
                    boxShadow: "0 6px 16px rgba(16, 185, 129, 0.35)",
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                      Monthly Attendance Register {selectedSubject ? `— ${selectedSubject.code}` : ""}
                    </h3>
                    <p style={{ margin: "2px 0 0 0", color: "var(--muted)", fontSize: 13 }}>
                      {register?.month_label || "Select semester and subject to view the calendar register."} · Faculty: {register?.faculty_name || user.full_name || user.username}
                    </p>
                  </div>
                </div>
              </div>

              {/* Month Picker & Print Button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label htmlFor="month-picker" style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Month:
                  </label>
                  <input
                    id="month-picker"
                    type="month"
                    className="input-field"
                    style={{ width: 170, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!printPdfUrl}
                  onClick={() => {
                    if (printPdfUrl) {
                      window.open(printPdfUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 16px",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: !printPdfUrl ? 0.5 : 1,
                    cursor: !printPdfUrl ? "not-allowed" : "pointer",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print Register (PDF)
                </button>
              </div>
            </div>

            {/* Status Legend */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              padding: "10px 16px",
              background: "var(--chip-bg-muted)",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
            }}>
              <span style={{ fontWeight: 800, color: "var(--text)" }}>Legend:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: "#067647", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>P</span>
                Present
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: "#b42318", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>A</span>
                Absent
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: "#d97706", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>H</span>
                Central / Sunday Holiday
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(0,0,0,0.06)", color: "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>·</span>
                No Session
              </span>
              {register && (
                <span style={{ marginLeft: "auto", color: "var(--text)", fontWeight: 700 }}>
                  Students: {register.roster.length} · Teaching Days: {register.days.filter(d => d.session_count > 0).length}
                </span>
              )}
            </div>

            {/* Selected Date Inspector Banner */}
            {selectedGridDate && selectedDayInfo && (
              <div style={{
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(37, 99, 235, 0.06) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                    📅 {selectedDayInfo.date} ({selectedDayInfo.weekday})
                    {selectedDayInfo.holiday && (
                      <span className="chip chip-yellow" style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px" }}>
                        🎉 Holiday: {selectedDayInfo.holiday_name || "Holiday"}
                      </span>
                    )}
                    {selectedDayInfo.session_id && (
                      <span className="chip chip-green" style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px" }}>
                        ✅ {selectedDayInfo.session_type || "CLASS"} ({selectedDayInfo.duration_hours}h)
                      </span>
                    )}
                  </div>
                  {selectedDayInfo.topic && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Topic: <em>"{selectedDayInfo.topic}"</em>
                    </div>
                  )}
                  {!selectedDayInfo.holiday && !selectedDayInfo.session_id && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      No attendance session was recorded on this day.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {selectedDayInfo.session_id && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => navigate(`/attendance/sessions/${selectedDayInfo.session_id}`)}
                      style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                    >
                      👁️ Open Saved Session
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedGridDate(null)}
                    style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12 }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Error / Loading States */}
            {registerError && <div className="login-error">{registerError}</div>}
            {loadingRegister && <div className="empty-note">Loading monthly register data…</div>}

            {/* Empty state if no subject/semester selected */}
            {!loadingRegister && !register && !registerError && (
              <div className="empty-note" style={{ padding: 24, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                {!semesterId || !subjectId
                  ? "Please select a semester and subject from the dropdown above to view the monthly register."
                  : "No attendance register data found for this selection."}
              </div>
            )}

            {/* Register Grid Table */}
            {!loadingRegister && register && (
              <div
                className="table-wrap"
                style={{
                  overflowX: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <table
                  className="data-table"
                  style={{
                    minWidth: 960,
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "var(--panel)" }}>
                      <th style={{
                        position: "sticky", left: 0, zIndex: 4, background: "var(--panel)",
                        width: 42, padding: "10px 8px", textAlign: "center", borderRight: "1px solid var(--border)",
                      }}>#</th>
                      <th style={{
                        position: "sticky", left: 42, zIndex: 4, background: "var(--panel)",
                        minWidth: 120, padding: "10px 10px", textAlign: "left", borderRight: "1px solid var(--border)",
                      }}>Hall Ticket</th>
                      <th style={{
                        position: "sticky", left: 162, zIndex: 4, background: "var(--panel)",
                        minWidth: 180, padding: "10px 10px", textAlign: "left", borderRight: "2px solid var(--border)",
                        boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
                      }}>Student Name</th>
                      {register.days.map((d) => {
                        const isSunday = d.weekday === "Sunday";
                        const isHoliday = d.holiday;
                        const hasSession = d.session_count > 0;
                        const isSelected = selectedGridDate === d.date;
                        return (
                          <th
                            key={d.date}
                            onClick={() => setSelectedGridDate(d.date)}
                            title={d.holiday_name || d.topic || (hasSession ? "Open session" : "No session recorded")}
                            style={{
                              minWidth: 34,
                              maxWidth: 38,
                              padding: "6px 2px",
                              textAlign: "center",
                              cursor: "pointer",
                              background: isSelected
                                ? "rgba(56, 189, 248, 0.25)"
                                : isHoliday
                                ? "#fff4d6"
                                : undefined,
                              borderRight: "1px solid var(--border)",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 12, color: isHoliday ? "#9a6700" : hasSession ? "var(--heading-accent)" : "var(--text)" }}>
                              {String(d.day).padStart(2, "0")}
                            </div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: isSunday ? "#ef4444" : isHoliday ? "#b45309" : "var(--muted)", textTransform: "uppercase" }}>
                              {d.weekday.slice(0, 2)}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {register.roster.map((row, rowIdx) => (
                      <tr
                        key={row.roll_no}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: rowIdx % 2 === 1 ? "var(--chip-bg-muted)" : undefined,
                        }}
                      >
                        <td style={{
                          position: "sticky", left: 0, zIndex: 2,
                          background: "var(--panel)",
                          textAlign: "center", fontSize: 11, color: "var(--muted)",
                          borderRight: "1px solid var(--border)",
                          padding: "6px 4px",
                        }}>
                          {rowIdx + 1}
                        </td>
                        <td style={{
                          position: "sticky", left: 42, zIndex: 2,
                          background: "var(--panel)",
                          fontWeight: 700, fontSize: 12, color: "var(--text)",
                          borderRight: "1px solid var(--border)",
                          padding: "6px 10px",
                          whiteSpace: "nowrap",
                        }}>
                          {row.roll_no}
                        </td>
                        <td style={{
                          position: "sticky", left: 162, zIndex: 2,
                          background: "var(--panel)",
                          fontSize: 12, color: "var(--text)",
                          borderRight: "2px solid var(--border)",
                          padding: "6px 10px",
                          whiteSpace: "nowrap",
                          boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
                        }}>
                          {row.name}
                        </td>
                        {row.cells.map((cell, cIdx) => {
                          const dayObj = register.days[cIdx];
                          const isHoliday = cell.status === "H" || dayObj?.holiday;
                          const isSelected = selectedGridDate === dayObj?.date;
                          return (
                            <td
                              key={cIdx}
                              onClick={() => dayObj && setSelectedGridDate(dayObj.date)}
                              title={dayObj ? `${dayObj.date}: ${cell.status === "P" ? "Present" : cell.status === "A" ? "Absent" : cell.status === "H" ? `Holiday (${dayObj.holiday_name || "Holiday"})` : "No session"}` : ""}
                              style={{
                                textAlign: "center",
                                padding: "6px 2px",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: "pointer",
                                borderRight: "1px solid var(--border)",
                                background: isSelected
                                  ? "rgba(56, 189, 248, 0.2)"
                                  : isHoliday
                                  ? "#fff8e7"
                                  : undefined,
                                color: cell.status === "P"
                                  ? "#067647"
                                  : cell.status === "A"
                                  ? "#b42318"
                                  : cell.status === "H"
                                  ? "#9a6700"
                                  : "var(--muted)",
                              }}
                            >
                              {cell.status || "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {register.roster.length === 0 && (
                      <tr>
                        <td colSpan={register.days.length + 3} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                          No students are currently assigned to this semester / HOD scope.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>


          {/* Semester View - Attendance History for Selected Semester */}
          <div
            className="card card-pad"
            style={{
              background: "var(--card-glass)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 15px 35px rgba(0,0,0,0.1)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                  📋 Semester Attendance View {selectedSemester ? `— ${selectedSemester.code}` : ""}
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: 13 }}>
                  {selectedSemester ? `Recent sessions recorded for ${selectedSemester.name}` : "Select a semester above to view its attendance history."}
                </p>
              </div>
              {semesterSessions.length > 0 && (
                <span className="chip chip-green" style={{ fontSize: 12, padding: "4px 12px" }}>
                  {semesterSessions.length} Session(s)
                </span>
              )}
            </div>

            {loadingSessions && <div className="empty-note">Loading semester sessions…</div>}

            {!loadingSessions && semesterSessions.length === 0 && (
              <div className="empty-note" style={{ padding: 24, background: "rgba(0,0,0,0.02)", borderRadius: 10 }}>
                {semesterId
                  ? `No attendance sessions recorded yet for ${selectedSemester?.code ?? "this semester"}.`
                  : "Please select a semester from the dropdown to view sessions."}
              </div>
            )}

            {!loadingSessions && semesterSessions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {semesterSessions.map((sess) => {
                  const total = sess.total_marked || (sess.present_count + sess.absent_count);
                  const pct = total > 0 ? Math.round((sess.present_count / total) * 100) : 0;
                  return (
                    <div
                      key={sess.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        background: "var(--chip-bg-muted)",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        flexWrap: "wrap",
                        gap: 12
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span className={`chip ${sess.session_type === "LAB" ? "chip-yellow" : "chip-green"}`} style={{ fontSize: 10, padding: "2px 8px" }}>
                            {sess.session_type}
                          </span>
                          <strong style={{ fontSize: 14, color: "var(--text)" }}>{sess.subject_name}</strong>
                          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>({sess.subject_code})</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>📅 {sess.attendance_date}</span>
                          <span>•</span>
                          <span>👤 {sess.faculty_name || sess.faculty_username}</span>
                          {sess.topic && (
                            <>
                              <span>•</span>
                              <span style={{ fontStyle: "italic" }}>"{sess.topic.length > 30 ? sess.topic.substring(0, 30) + '…' : sess.topic}"</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>
                            {pct}% Present
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {sess.present_count} / {total} Attended
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/attendance/sessions/${sess.id}`)}
                          style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}
                        >
                          👁️ View Register
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
