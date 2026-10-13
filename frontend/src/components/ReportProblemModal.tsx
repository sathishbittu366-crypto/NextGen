import { useEffect, useRef, useState, type FormEvent } from "react";
import { submitProblemReport } from "../api/reports";
import { ApiClientError } from "../api/client";
import "../styles/ng-flat-controls.css";
import "./report-problem.css";

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "General",
  "Bug / Error",
  "Attendance Issue",
  "Login / Access",
  "UI / Layout",
  "Feature Request",
  "Performance / Slow Load",
];

export function ReportProblemModal({ isOpen, onClose }: ReportProblemModalProps) {
  const [category, setCategory] = useState("General");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);

  // Esc closes; focus lands on the first thing to type.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    subjectRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!subject.trim()) { setError("Add a short summary of the problem."); return; }
    if (!description.trim()) { setError("Describe what happened so an administrator can follow up."); return; }

    setSubmitting(true);
    try {
      const res = await submitProblemReport({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });
      setSuccess(res.message);
      setSubject("");
      setDescription("");
      setCategory("General");
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div
        className="rp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rp-head">
          <div>
            <h2 id="rp-title">Report a problem</h2>
            <p>Only administrators can see your report.</p>
          </div>
          <button type="button" className="rp-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <form className="rp-form" onSubmit={handleSubmit} noValidate>
          <div className="rp-field">
            <label htmlFor="report-category">Category</label>
            <select id="report-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="rp-field">
            <label htmlFor="report-subject">Summary</label>
            <input
              id="report-subject"
              ref={subjectRef}
              type="text"
              placeholder="e.g. Attendance page not updating"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="rp-field">
            <label htmlFor="report-description">What happened?</label>
            <textarea
              id="report-description"
              placeholder="Error messages, or the steps that led to it"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="rp-msg is-error" role="alert">{error}</p>}
          {success && <p className="rp-msg is-ok" role="status">{success}</p>}

          <div className="rp-actions">
            <button type="button" className="ng-flat-btn ng-flat-btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="ng-flat-btn ng-flat-btn-primary" disabled={submitting}>{submitting ? "Sending…" : "Send report"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
