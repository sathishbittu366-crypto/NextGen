import { useEffect, useMemo, useState } from "react";
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
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
};

const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-IN");

const pct = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(1)}%`;

function Icon({ name, size = 18 }: { name: "upload" | "users" | "book" | "chart" | "search" | "filter" | "arrow" | "close" | "calendar" | "trend"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "upload": return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>;
    case "users": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.74" /></svg>;
    case "book": return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5a2.5 2.5 0 0 0 2.5-2.5z" /></svg>;
    case "chart": return <svg {...common}><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    case "filter": return <svg {...common}><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></svg>;
    case "arrow": return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "close": return <svg {...common}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></svg>;
    case "trend": return <svg {...common}><path d="m3 17 6-6 4 4 8-8" /><path d="M16 7h5v5" /></svg>;
  }
}

function MetricCard({ icon, label, value, note, tone = "neutral" }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string; note?: string; tone?: string }) {
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

function SubjectPassChart({ items }: { items: ResultsAdminDetail["subject_analysis"] }) {
  if (!items.length) {
    return <div className="results-chart-empty">Subject-level pass information is not available for this result.</div>;
  }
  const chartItems = items.slice(0, 8);
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
            <div className="results-bar-group" key={item.subject_code} title={`${item.subject_name}: ${pct(item.pass_percentage)}`}>
              <div className="results-bar-value">{pct(item.pass_percentage)}</div>
              <div className="results-bar-track"><div className="results-bar-fill" style={{ height: `${height}%` }} /></div>
              <div className="results-bar-label">{item.subject_code || item.subject_name.slice(0, 6)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const gradeOrder = ["O", "A+", "A", "B+", "B", "C", "P", "F", "AB"];
const gradeTones = ["#1d9b6c", "#4f86df", "#8aa4ef", "#f3bd35", "#f3a46c", "#b19be8", "#7aa6cc", "#bd5a63", "#7b6e87"];

function GradeDistributionChart({ distribution }: { distribution: ResultsAdminDetail["grade_distribution"] }) {
  if (!distribution.length) {
    return <div className="results-chart-empty">Grade data is not available in this result.</div>;
  }
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="results-grade-chart">
      <div className="results-donut-wrap">
        <svg className="results-donut" viewBox="0 0 100 100" role="img" aria-label="Grade distribution">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#edf1f4" strokeWidth="14" />
          {distribution.map((item, index) => {
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
        {distribution.map((item, index) => (
          <div key={item.grade} className="results-grade-row">
            <span className="results-grade-dot" style={{ background: gradeTones[index % gradeTones.length] }} />
            <span>{item.grade}</span>
            <strong>{item.count}</strong>
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

export function ResultsAdminPage({ user, onLoggedOut }: Props) {
  const [data, setData] = useState<ResultsAdminDashboard | null>(null);
  const [detail, setDetail] = useState<ResultsAdminDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [batchFilter, setBatchFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const loadDashboard = async (selectId?: number | null) => {
    try {
      setLoading(true);
      setError(null);
      const next = await getResultsAdminDashboard();
      setData(next);
      const target = selectId ?? selectedId ?? next.uploads[0]?.id ?? null;
      setSelectedId(target);
      if (target) {
        setDetailLoading(true);
        const selected = await getResultsAdminDetail(target);
        setDetail(selected);
      } else {
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load results dashboard");
    } finally {
      setLoading(false);
      setDetailLoading(false);
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

  const activeUpload = uploads.find((item) => item.id === selectedId) ?? uploads[0] ?? null;

  useEffect(() => {
    if (activeUpload && activeUpload.id !== selectedId) {
      setSelectedId(activeUpload.id);
      void (async () => {
        try {
          setDetailLoading(true);
          setDetail(await getResultsAdminDetail(activeUpload.id));
        } catch (err) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load result details");
        } finally {
          setDetailLoading(false);
        }
      })();
    }
    if (!activeUpload && selectedId !== null) setSelectedId(null);
  }, [activeUpload?.id, selectedId]);

  const selectResult = async (id: number) => {
    setSelectedId(id);
    setMobileDetailOpen(true);
    if (window.matchMedia("(max-width: 860px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    setDetail(null);
    try {
      setDetailLoading(true);
      setError(null);
      setDetail(await getResultsAdminDetail(id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load result details");
    } finally {
      setDetailLoading(false);
    }
  };

  const resetFilters = () => {
    setBatchFilter("");
    setSemesterFilter("");
    setTitleFilter("");
    setSearch("");
  };

  const hasFilters = Boolean(batchFilter || semesterFilter || titleFilter || search);
  const latest = activeUpload;

  return (
    <AppShell user={user} activeNav="results" heading="Results" onLoggedOut={onLoggedOut}>
      <div className={`results-admin-shell${mobileDetailOpen ? " mobile-result-detail-open" : ""}`}>
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

        <section className="results-kpi-grid" aria-label="Results summary">
          <MetricCard icon="upload" label="Total Results Uploads" value={number(data?.total_uploads)} note={data?.total_uploads != null ? "Across this workspace" : undefined} tone="green" />
          <MetricCard icon="users" label="Students Covered" value={number(latest?.students_count)} note={latest ? "Latest uploaded result" : "Latest result"} tone="blue" />
          <MetricCard icon="book" label="Subjects" value={number(latest?.subject_count)} note={latest ? latest.semester_name : "Latest result"} tone="violet" />
          <MetricCard icon="chart" label="Latest Pass Rate" value={pct(latest?.pass_percentage)} note={latest ? latest.title : "No uploaded results yet"} tone="amber" />
        </section>

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
            <section className="results-analytics-grid" aria-label="Result analytics">
              <article className="results-panel">
                <div className="results-panel-head">
                  <div><h2>Subject-wise Pass Percentage</h2><p>{latest ? `${latest.title} · ${latest.semester_code}` : "Latest uploaded result"}</p></div>
                  {latest && <span className="results-panel-note">{number(latest.subject_count)} subjects</span>}
                </div>
                <SubjectPassChart items={detail?.subject_analysis ?? []} />
              </article>
              <article className="results-panel">
                <div className="results-panel-head">
                  <div><h2>Grade Distribution</h2><p>Across graded subject entries</p></div>
                  {detail && <span className="results-panel-note">{number(detail.overview.total_subject_entries)} entries</span>}
                </div>
                <GradeDistributionChart distribution={detail?.grade_distribution ?? []} />
              </article>
            </section>

            <section className="results-panel results-uploaded-panel">
              <div className="results-panel-head results-uploaded-head">
                <div><h2>Uploaded Results</h2><p>Result files available for analysis.</p></div>
                <div className="results-uploaded-search"><Icon name="search" size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search results…" aria-label="Search uploaded results" /></div>
              </div>
              <div className="results-table-wrap">
                <table className="results-admin-table">
                  <thead><tr><th>#</th><th>Title</th><th>Batch</th><th>Branch</th><th>Semester</th><th>Students</th><th>Subjects</th><th>Pass %</th><th>Uploaded</th><th aria-label="Action" /></tr></thead>
                  <tbody>
                    {uploads.map((item, index) => (
                      <tr key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => void selectResult(item.id)}>
                        <td>{index + 1}.</td>
                        <td><div className="results-title-cell"><strong>{item.title}</strong>{item.id === data?.uploads[0]?.id && <span>Latest</span>}</div></td>
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
                  <button key={item.id} type="button" className={`results-mobile-result-card ${item.id === selectedId ? "is-selected" : ""}`} onClick={() => void selectResult(item.id)}>
                    <div className="results-mobile-result-main">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.batch || "Batch not recorded"} · {item.department || "—"}</span>
                        <span>{item.semester_name}</span>
                      </div>
                      <div className="results-mobile-result-pass">{pct(item.pass_percentage)}</div>
                    </div>
                    <div className="results-mobile-result-meta"><span><Icon name="users" size={13} />{number(item.students_count)} students</span><span><Icon name="book" size={13} />{number(item.subject_count)} subjects</span><span><Icon name="calendar" size={13} />{shortDate(item.created_at)}</span><Icon name="arrow" size={15} /></div>
                  </button>
                ))}
              </div>
            </section>

            <section className="results-panel results-selected-panel" aria-live="polite">
              {detailLoading || !detail ? (
                <div className="results-detail-loading">{detailLoading ? "Loading result analysis…" : "Select an uploaded result to inspect its analysis."}</div>
              ) : (
                <>
                  <div className="results-mobile-detail-back">
                    <button type="button" onClick={() => setMobileDetailOpen(false)}>← Back to results</button>
                  </div>
                  <div className="results-selected-head">
                    <div>
                      <div className="results-selected-kicker">Selected result</div>
                      <h2>{detail.batch.title}</h2>
                      <p>{detail.batch.batch || "Batch not recorded"} · {detail.batch.department} · {detail.batch.semester_name}</p>
                    </div>
                    <div className="results-selected-meta">
                      <span><Icon name="calendar" size={14} />{shortDate(detail.batch.created_at)}</span>
                      <strong>{pct(detail.overview.pass_percentage)}</strong>
                    </div>
                  </div>
                  <div className="results-tabs" role="tablist" aria-label="Selected result sections">
                    <a href="#overview">Overview</a><a href="#subject-wise">Subject-wise</a><a href="#grades">Grade Distribution</a><a href="#top-performers">Top Performers</a><a href="#at-risk">At-risk Students</a>
                  </div>
                  <div id="overview" className="results-overview-grid">
                    <MetricCard icon="users" label="Total Students" value={number(detail.overview.total_students)} tone="blue" />
                    <MetricCard icon="trend" label="Passed" value={number(detail.overview.passed_students)} tone="green" />
                    <MetricCard icon="chart" label="Failed" value={number(detail.overview.failed_students)} tone="red" />
                    <MetricCard icon="trend" label="Pass Percentage" value={pct(detail.overview.pass_percentage)} tone="amber" />
                  </div>
                  <div className="results-detail-split">
                    <article id="subject-wise" className="results-detail-card-block"><div className="results-subsection-head"><h3>Subject-wise analysis</h3><span>{number(detail.subject_analysis.length)} subjects</span></div><SubjectPassChart items={detail.subject_analysis} /></article>
                    <article id="grades" className="results-detail-card-block"><div className="results-subsection-head"><h3>Grade distribution</h3><span>Graded entries</span></div><GradeDistributionChart distribution={detail.grade_distribution} /></article>
                  </div>
                  <div className="results-bottom-grid">
                    <article id="top-performers" className="results-detail-card-block"><div className="results-subsection-head"><h3>Top performers</h3><span>{detail.top_performers_metric}</span></div>{detail.top_performers.length ? <div className="results-performer-list">{detail.top_performers.map((student, index) => <div className="results-person-row" key={student.roll_no}><span className="results-rank">{index + 1}</span><div><strong>{student.name}</strong><small>{student.roll_no}</small></div><span className="results-person-score">{student.score == null ? "—" : detail.top_performers_metric === "SGPA" ? student.score.toFixed(2) : `${student.score.toFixed(1)}%`}</span></div>)}</div> : <div className="results-inline-empty">No ranking field is available in this result.</div>}</article>
                    <article id="at-risk" className="results-detail-card-block"><div className="results-subsection-head"><h3>At-risk / failed students</h3><span>{number(detail.overview.failed_students)} failed</span></div>{detail.at_risk_students.length ? <div className="results-risk-list">{detail.at_risk_students.slice(0, 8).map((student) => <div className="results-risk-row" key={student.roll_no}><div><strong>{student.name}</strong><small>{student.roll_no}</small></div><span>{student.failed_subject_count} failed subject{student.failed_subject_count === 1 ? "" : "s"}</span></div>)}</div> : <div className="results-inline-empty">No failed students were identified from the available grade/status data.</div>}</article>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {showUpload && <ResultsUploadDrawer user={user} onLoggedOut={onLoggedOut} onClose={() => setShowUpload(false)} onUploaded={(batchId) => { void loadDashboard(batchId); }} />}
    </AppShell>
  );
}
