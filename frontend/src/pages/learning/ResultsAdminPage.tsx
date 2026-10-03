import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ApiClientError } from "../../api/client";
import { type CurrentUser } from "../../api/auth";
import {
  getResultsAdminDashboard,
  getResultsAdminDetail,
  type ResultsAdminDashboard,
  type ResultsAdminDetail,
} from "../../api/learning";
import { ResultsUploadPage } from "./ResultsUploadPage";
import "./results-admin.css";

interface Props {
  user: CurrentUser;
  onLoggedOut: () => void;
}

const shortDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 11);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const number = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("en-IN");

const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(1)}%`;

function Icon({
  name,
  size = 18,
}: {
  name:
    | "upload"
    | "users"
    | "book"
    | "chart"
    | "search"
    | "filter"
    | "arrow"
    | "close"
    | "calendar"
    | "trend";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "upload":
      return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.74" /></svg>;
    case "book":
      return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5a2.5 2.5 0 0 0 2.5-2.5z" /></svg>;
    case "chart":
      return <svg {...common}><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    case "filter":
      return <svg {...common}><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></svg>;
    case "arrow":
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></svg>;
    case "trend":
      return <svg {...common}><path d="m3 17 6-6 4 4 8-8" /><path d="M16 7h5v5" /></svg>;
  }
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <article className="results-metric-card">
      <div className={`results-metric-icon ${tone}`}><Icon name={icon} size={17} /></div>
      <div className="results-metric-content">
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  );
}

function SubjectPassChart({
  items,
  aggregate = false,
}: {
  items: ResultsAdminDetail["subject_analysis"];
  aggregate?: boolean;
}) {
  if (!items.length) {
    return <div className="results-chart-empty">Subject-level pass information is not available for this view.</div>;
  }

  const chartItems = [...items]
    .sort((a, b) => (b.pass_percentage ?? -1) - (a.pass_percentage ?? -1))
    .slice(0, 8);

  return (
    <div className="results-bar-chart" role="img" aria-label="Subject-wise pass percentage">
      <div className="results-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
      <div className="results-bars">
        <div className="results-gridline grid-100" />
        <div className="results-gridline grid-75" />
        <div className="results-gridline grid-50" />
        <div className="results-gridline grid-25" />
        <div className="results-gridline grid-0" />
        {chartItems.map((item) => {
          const height = item.pass_percentage == null ? 0 : Math.max(4, Math.min(100, item.pass_percentage));
          return (
            <div
              className="results-bar-group"
              key={`${item.subject_code}-${item.subject_name}`}
              title={`${item.subject_name}: ${pct(item.pass_percentage)}`}
              style={{ "--bar-height": `${height}%` } as CSSProperties}
            >
              <div className="results-bar-value">{pct(item.pass_percentage)}</div>
              <div className="results-bar-track"><div className="results-bar-fill" /></div>
              <div className="results-bar-label" title={item.subject_name}>
                {item.subject_name}
              </div>
            </div>
          );
        })}
      </div>
      {aggregate && items.length > 8 && <span className="results-chart-footnote">Showing the 8 highest-volume subject groups.</span>}
    </div>
  );
}

const gradeOrder = ["O", "A+", "A", "B+", "B", "C", "P", "F", "AB"];
const gradeTones = ["#1d9b6c", "#4f86df", "#8aa4ef", "#f3bd35", "#f3a46c", "#b19be8", "#7aa6cc", "#bd5a63", "#7b6e87"];

function GradeDistributionChart({ distribution }: { distribution: ResultsAdminDetail["grade_distribution"] }) {
  if (!distribution.length) {
    return <div className="results-chart-empty">Grade data is not available for this view.</div>;
  }

  const ordered = [...distribution].sort((a, b) => {
    const ai = gradeOrder.indexOf(a.grade);
    const bi = gradeOrder.indexOf(b.grade);
    if (ai === -1 && bi === -1) return a.grade.localeCompare(b.grade);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const total = ordered.reduce((sum, item) => sum + item.count, 0);
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="results-grade-chart">
      <div className="results-donut-wrap">
        <svg className="results-donut" viewBox="0 0 100 100" role="img" aria-label="Grade distribution">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#edf1f4" strokeWidth="14" />
          {ordered.map((item, index) => {
            const length = total ? (item.count / total) * circumference : 0;
            const circle = (
              <circle
                key={item.grade}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={gradeTones[index % gradeTones.length]}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="results-donut-center"><strong>{number(total)}</strong><span>graded entries</span></div>
      </div>
      <div className="results-grade-legend">
        {ordered.map((item, index) => (
          <div key={item.grade} className="results-grade-row">
            <span className="results-grade-dot" style={{ background: gradeTones[index % gradeTones.length] }} />
            <span>{item.grade}</span>
            <strong>{number(item.count)}</strong>
            <small>{total ? `${Math.round((item.count / total) * 100)}%` : "0%"}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsUploadDrawer({
  user,
  onLoggedOut,
  onClose,
  onUploaded,
}: {
  user: CurrentUser;
  onLoggedOut: () => void;
  onClose: () => void;
  onUploaded: (batchId: number) => void;
}) {
  return (
    <div className="results-upload-overlay" role="dialog" aria-modal="true" aria-label="Upload student results">
      <button className="results-upload-backdrop" type="button" aria-label="Close upload form" onClick={onClose} />
      <aside className="results-upload-drawer">
        <div className="results-upload-drawer-head">
          <div className="results-upload-brand"><img src="/logo.png" alt="" /><strong>NextGen SMS</strong></div>
          <button className="results-icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <ResultsUploadPage user={user} onLoggedOut={onLoggedOut} embedded onClose={onClose} onUploaded={onUploaded} />
      </aside>
    </div>
  );
}

function buildAggregate(details: ResultsAdminDetail[]): ResultsAdminDetail | null {
  if (!details.length) return null;

  const totalStudents = details.reduce((sum, d) => sum + d.overview.total_students, 0);
  const passedStudents = details.reduce((sum, d) => sum + d.overview.passed_students, 0);
  const failedStudents = details.reduce((sum, d) => sum + d.overview.failed_students, 0);
  const unknownStudents = details.reduce((sum, d) => sum + d.overview.unknown_students, 0);
  const totalEntries = details.reduce((sum, d) => sum + d.overview.total_subject_entries, 0);

  const subjects = new Map<string, ResultsAdminDetail["subject_analysis"][number]>();
  const grades = new Map<string, number>();

  details.forEach((detail) => {
    detail.subject_analysis.forEach((item) => {
      const key = `${item.subject_code}::${item.subject_name}`;
      const current = subjects.get(key);
      if (!current) {
        subjects.set(key, { ...item });
        return;
      }
      const classified = current.classified_students + item.classified_students;
      current.students += item.students;
      current.classified_students = classified;
      current.passed += item.passed;
      current.failed += item.failed;
      current.pass_percentage = classified ? (current.passed / classified) * 100 : null;
    });
    detail.grade_distribution.forEach((item) => {
      grades.set(item.grade, (grades.get(item.grade) ?? 0) + item.count);
    });
  });

  return {
    batch: {
      id: 0,
      title: "Published results · aggregate",
      department: details.length === 1 ? details[0].batch.department : "Multiple result sets",
      batch: details.length === 1 ? details[0].batch.batch : null,
      semester_id: 0,
      semester_code: "ALL",
      semester_name: "All published semesters",
      created_at: details[0].batch.created_at,
      source_filename: null,
    },
    overview: {
      total_students: totalStudents,
      passed_students: passedStudents,
      failed_students: failedStudents,
      unknown_students: unknownStudents,
      pass_percentage: totalStudents ? (passedStudents / totalStudents) * 100 : null,
      total_subject_entries: totalEntries,
    },
    subject_analysis: Array.from(subjects.values()),
    grade_distribution: Array.from(grades.entries()).map(([grade, count]) => ({ grade, count })),
    top_performers_metric: "Percentage",
    top_performers: [],
    at_risk_students: [],
  };
}

export function ResultsAdminPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<ResultsAdminDashboard | null>(null);
  const [detailsById, setDetailsById] = useState<Record<number, ResultsAdminDetail>>({});
  const [aggregateDetail, setAggregateDetail] = useState<ResultsAdminDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [batchFilter, setBatchFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadDashboard = async (selectId?: number | null) => {
    try {
      setLoading(true);
      setError(null);
      const next = await getResultsAdminDashboard();
      setData(next);
      setSelectedId(selectId ?? null);
      setDetailsById({});
      setAggregateDetail(null);

      if (next.uploads.length) {
        setAggregateLoading(true);
        const settled = await Promise.allSettled(
          next.uploads.map((item) => getResultsAdminDetail(item.id)),
        );
        const successful = settled
          .filter((result): result is PromiseFulfilledResult<ResultsAdminDetail> => result.status === "fulfilled")
          .map((result) => result.value);
        setDetailsById(Object.fromEntries(successful.map((detail) => [detail.batch.id, detail])));
        setAggregateDetail(buildAggregate(successful));
      }

      if (selectId) {
        const selected = await getResultsAdminDetail(selectId);
        setDetailsById((prev) => ({ ...prev, [selectId]: selected }));
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load results dashboard");
    } finally {
      setLoading(false);
      setAggregateLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const uploads = useMemo(() => {
    const source = data?.uploads ?? [];
    return source.filter((item) => {
      const searchText = search.trim().toLowerCase();
      const matchesSearch = !searchText || `${item.title} ${item.batch} ${item.department} ${item.semester_name} ${item.semester_code}`.toLowerCase().includes(searchText);
      const matchesBatch = !batchFilter || item.batch === batchFilter;
      const matchesSemester = !semesterFilter || String(item.semester_id) === semesterFilter;
      const matchesTitle = !titleFilter || item.title === titleFilter;
      return matchesSearch && matchesBatch && matchesSemester && matchesTitle;
    });
  }, [data, search, batchFilter, semesterFilter, titleFilter]);

  useEffect(() => {
    if (selectedId && !uploads.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [uploads, selectedId]);

  const selectedDetail = selectedId ? detailsById[selectedId] ?? null : null;
  const activeAnalysis = selectedDetail ?? aggregateDetail;
  const activeUpload = selectedId ? uploads.find((item) => item.id === selectedId) ?? null : null;

  const selectResult = async (id: number) => {
    setSelectedId(id);
    const cached = detailsById[id];
    if (cached) {
      requestAnimationFrame(() => document.querySelector(".results-analysis-surface")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }

    try {
      setDetailLoading(true);
      setError(null);
      const selected = await getResultsAdminDetail(id);
      setDetailsById((prev) => ({ ...prev, [id]: selected }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load result details");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
      requestAnimationFrame(() => document.querySelector(".results-analysis-surface")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const resetFilters = () => {
    setBatchFilter("");
    setSemesterFilter("");
    setTitleFilter("");
    setSearch("");
  };

  const hasFilters = Boolean(batchFilter || semesterFilter || titleFilter || search);
  const displayedKpis = activeAnalysis?.overview;
  const subjectItems = activeAnalysis?.subject_analysis ?? [];
  const gradeItems = activeAnalysis?.grade_distribution ?? [];

  return (
    <AppShell user={user} activeNav="results" heading="Results" onLoggedOut={onLoggedOut}>
      <div className="results-admin-shell">
        <header className="results-page-head">
          <div>
            <p>Manage and analyze student examination results.</p>
          </div>
          <div className="results-head-actions">
            <button className="btn results-upload-btn" type="button" onClick={() => setShowUpload(true)}>
              <Icon name="upload" size={17} />
              Upload Results
            </button>
          </div>
        </header>

        {error && <div className="error-banner results-error">{error}</div>}

        <section className="results-filter-bar" aria-label="Result filters">
          <div className="results-filter-heading"><Icon name="filter" size={16} /><span>Filter results</span></div>
          <label>
            <span>Batch</span>
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">All batches</option>
              {data?.filter_options.batches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
            </select>
          </label>
          <label>
            <span>Semester</span>
            <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
              <option value="">All semesters</option>
              {data?.filter_options.semesters.map((semester) => <option key={semester.id} value={String(semester.id)}>{semester.name}</option>)}
            </select>
          </label>
          <label>
            <span>Result</span>
            <select value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)}>
              <option value="">All results</option>
              {data?.filter_options.titles.map((title) => <option key={title} value={title}>{title}</option>)}
            </select>
          </label>
          <div className="results-filter-search">
            <Icon name="search" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search results…" aria-label="Search results" />
          </div>
          {hasFilters && <button type="button" className="btn btn-outline results-reset-btn" onClick={resetFilters}>Reset</button>}
        </section>

        {loading ? (
          <div className="results-loading">Loading results…</div>
        ) : uploads.length === 0 ? (
          <section className="results-empty-state">
            <div className="results-empty-icon"><Icon name="chart" size={22} /></div>
            <strong>{data?.uploads.length ? "No results match these filters" : "No results have been uploaded yet"}</strong>
            <span>{data?.uploads.length ? "Adjust the filters or reset the view." : "Use Upload Results to add the first result file."}</span>
            <div className="results-empty-actions">
              {hasFilters && <button className="btn btn-outline" type="button" onClick={resetFilters}>Reset filters</button>}
              {!data?.uploads.length && <button className="btn results-upload-btn" type="button" onClick={() => setShowUpload(true)}><Icon name="upload" size={16} />Upload Results</button>}
            </div>
          </section>
        ) : (
          <>
            <section className="results-analysis-surface" aria-live="polite" aria-label="Result performance analysis">
              <div className="results-analysis-head">
                <div className="results-analysis-heading">
                  <span className="results-analysis-kicker">{selectedId ? "Semester performance" : "Aggregate view"}</span>
                  <h2>{activeUpload?.title ?? "Published result overview"}</h2>
                  <p>
                    {selectedDetail
                      ? `${activeUpload?.batch || "Batch not recorded"} · ${activeUpload?.department || "Branch not recorded"} · ${activeUpload?.semester_name}`
                      : "Combined view across published results. Open a semester to reuse this same analysis area for that result."}
                  </p>
                </div>
                <div className="results-analysis-state">
                  {selectedId ? (
                    <button className="results-selection-pill" type="button" onClick={() => setSelectedId(null)}>
                      {activeUpload?.semester_name ?? "Selected semester"}<Icon name="close" size={12} />
                    </button>
                  ) : (
                    <span className="results-selection-muted">No semester selected</span>
                  )}
                </div>
              </div>

              <div className="results-kpi-grid" aria-label="Current result summary">
                <MetricCard icon="users" label="Students" value={number(displayedKpis?.total_students)} note={selectedId ? "Selected semester" : "Across published results"} tone="blue" />
                <MetricCard icon="trend" label="Passed" value={number(displayedKpis?.passed_students)} note={selectedId ? "Passing students" : "Passing students"} tone="green" />
                <MetricCard icon="chart" label="Failed" value={number(displayedKpis?.failed_students)} note={selectedId ? "At least one failure" : "Across published results"} tone="red" />
                <MetricCard icon="trend" label="Pass percentage" value={pct(displayedKpis?.pass_percentage)} note={selectedId ? activeUpload?.semester_name : "Published-result aggregate"} tone="amber" />
              </div>

              {aggregateLoading && !selectedDetail ? (
                <div className="results-analysis-loading">Building aggregate analysis…</div>
              ) : detailLoading && selectedId && !selectedDetail ? (
                <div className="results-analysis-loading">Loading semester analysis…</div>
              ) : (
                <div className="results-analytics-grid">
                  <article className="results-panel">
                    <div className="results-panel-head">
                      <div><h2>Subject-wise Pass Percentage</h2><p>{selectedId ? "Pass rate by subject for this semester" : "Pass rate grouped by subject across published results"}</p></div>
                      <span className="results-panel-note">{number(subjectItems.length)} subjects</span>
                    </div>
                    <SubjectPassChart items={subjectItems} aggregate={!selectedId} />
                  </article>
                  <article className="results-panel">
                    <div className="results-panel-head">
                      <div><h2>Grade Distribution</h2><p>{selectedId ? "Graded subject entries in this semester" : "Graded subject entries across published results"}</p></div>
                      <span className="results-panel-note">{number(displayedKpis?.total_subject_entries)} entries</span>
                    </div>
                    <GradeDistributionChart distribution={gradeItems} />
                  </article>
                </div>
              )}
            </section>

            <section className="results-panel results-uploaded-panel">
              <div className="results-panel-head results-uploaded-head">
                <div><h2>Published Results</h2><p>Click the title, any row area, or the action to inspect that semester.</p></div>
                <div className="results-uploaded-search"><Icon name="search" size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search results…" aria-label="Search uploaded results" /></div>
              </div>

              <div className="results-table-wrap">
                <table className="results-admin-table">
                  <thead><tr><th>#</th><th>Title</th><th>Batch</th><th>Branch</th><th>Semester</th><th>Students</th><th>Subjects</th><th>Pass %</th><th>Uploaded</th><th aria-label="Action" /></tr></thead>
                  <tbody>
                    {uploads.map((item, index) => (
                      <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => void selectResult(item.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void selectResult(item.id); } }}>
                        <td>{index + 1}.</td>
                        <td>
                          <button className="results-title-button" type="button" onClick={(event) => { event.stopPropagation(); void selectResult(item.id); }}>
                            <strong>{item.title}</strong>
                            {item.id === data?.uploads[0]?.id && <span>Latest</span>}
                          </button>
                        </td>
                        <td>{item.batch || "—"}</td>
                        <td>{item.department || "—"}</td>
                        <td>{item.semester_name}</td>
                        <td>{number(item.students_count)}</td>
                        <td>{number(item.subject_count)}</td>
                        <td><span className={`results-pass-pill ${item.pass_percentage != null && item.pass_percentage < 75 ? "warn" : ""}`}>{pct(item.pass_percentage)}</span></td>
                        <td>{shortDate(item.created_at)}</td>
                        <td><button className="results-view-btn" type="button" onClick={(event) => { event.stopPropagation(); void selectResult(item.id); }}>View <Icon name="arrow" size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="results-mobile-list">
                {uploads.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`results-mobile-result-card ${item.id === selectedId ? "is-selected" : ""}`}
                    onClick={() => void selectResult(item.id)}
                  >
                    <div className="results-mobile-result-main">
                      <div>
                        <div className="results-mobile-result-label">{item.semester_name}</div>
                        <strong>{item.title}</strong>
                        <span>{item.batch || "Batch not recorded"} · {item.department || "Branch not recorded"}</span>
                      </div>
                      <div className="results-mobile-result-pass"><strong>{pct(item.pass_percentage)}</strong><span>pass</span></div>
                    </div>
                    <div className="results-mobile-result-meta">
                      <span><Icon name="users" size={13} />{number(item.students_count)}</span>
                      <span><Icon name="book" size={13} />{number(item.subject_count)}</span>
                      <span><Icon name="calendar" size={13} />{shortDate(item.created_at)}</span>
                      <span className="results-mobile-open">Open <Icon name="arrow" size={14} /></span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {selectedDetail && (
              <section className="results-panel results-selected-panel" aria-live="polite">
                <div className="results-selected-head">
                  <div>
                    <span className="results-selected-kicker">Selected semester details</span>
                    <h2>{selectedDetail.batch.title}</h2>
                    <p>{selectedDetail.batch.batch || "Batch not recorded"} · {selectedDetail.batch.department} · {selectedDetail.batch.semester_name}</p>
                  </div>
                  <div className="results-selected-meta"><span><Icon name="calendar" size={14} />{shortDate(selectedDetail.batch.created_at)}</span><strong>{pct(selectedDetail.overview.pass_percentage)}</strong></div>
                </div>
                <div className="results-detail-support-grid">
                  <article className="results-detail-card-block">
                    <div className="results-subsection-head"><h3>Top performers</h3><span>{selectedDetail.top_performers_metric}</span></div>
                    {selectedDetail.top_performers.length ? (
                      <div className="results-performer-list">
                        {selectedDetail.top_performers.map((student, index) => (
                          <div className="results-person-row" key={student.roll_no}>
                            <span className="results-rank">{index + 1}</span>
                            <div><strong>{student.name}</strong><small>{student.roll_no}</small></div>
                            <span className="results-person-score">{student.score == null ? "—" : selectedDetail.top_performers_metric === "SGPA" ? student.score.toFixed(2) : `${student.score.toFixed(1)}%`}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="results-inline-empty">No ranking field is available in this result.</div>
                    )}
                  </article>

                  <article className="results-detail-card-block">
                    <div className="results-subsection-head"><h3>At-risk / failed students</h3><span>{number(selectedDetail.overview.failed_students)} failed</span></div>
                    {selectedDetail.at_risk_students.length ? (
                      <div className="results-risk-list">
                        {selectedDetail.at_risk_students.slice(0, 8).map((student) => (
                          <div className="results-risk-row" key={student.roll_no}>
                            <div><strong>{student.name}</strong><small>{student.roll_no}</small></div>
                            <span>{student.failed_subject_count} failed subject{student.failed_subject_count === 1 ? "" : "s"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="results-inline-empty">No failed students were identified from the available grade/status data.</div>
                    )}
                  </article>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showUpload && <ResultsUploadDrawer user={user} onLoggedOut={onLoggedOut} onClose={() => setShowUpload(false)} onUploaded={(batchId) => { void loadDashboard(batchId); }} />}
    </AppShell>
  );
}
