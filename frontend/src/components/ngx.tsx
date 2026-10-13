// Shared building blocks for the redesigned SMS Log and Faculty screens.
// Styling lives in styles/ngx.css and is scoped under `.ngx`, so nothing here
// leaks into screens that have not been migrated yet.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/* ── Icons ─────────────────────────────────────────────────────────────── */

const PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  send: "m22 2-7 20-4-9-9-4zM22 2 11 13",
  filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="ngx-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ── Status pill ───────────────────────────────────────────────────────── */

export type Tone = "good" | "bad" | "warn" | "muted" | "info";

export function Pill({ tone = "muted", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`ngx-pill is-${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}

/** "NOT_CONNECTED" → "Not connected" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Tabs ──────────────────────────────────────────────────────────────── */

export interface TabDef { id: string; label: string; count?: number | string | null; alert?: boolean }

export function Tabs({ tabs, active, onChange, label }: { tabs: TabDef[]; active: string; onChange: (id: string) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };
  return (
    <div className="ngx-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(n) => { refs.current[t.id] = n; }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === active}
          aria-controls={`panel-${t.id}`}
          tabIndex={t.id === active ? 0 : -1}
          className={`ngx-tab${t.id === active ? " is-active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="ngx-tab-count">{t.count}</span>}
          {t.alert && <span className="ngx-tab-alert" aria-label="needs attention" />}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  // Inactive panels stay mounted (hidden) so filters, drafts and scroll-free
  // form state are exactly as the person left them when they come back.
  return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={id !== active} className="ngx-panel">{children}</div>;
}

/* ── Switch ────────────────────────────────────────────────────────────── */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`ngx-switch${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────── */

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "danger";
  /** Block backdrop / Esc dismissal while a request is in flight. */
  locked?: boolean;
}

export function Modal({ title, onClose, children, footer, size = "md", tone = "default", locked }: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.requestAnimationFrame(() => {
      const el = cardRef.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea") ?? cardRef.current?.querySelector<HTMLElement>("button");
      el?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      restore.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !locked) { e.preventDefault(); onClose(); }
      if (e.key === "Tab" && cardRef.current) {
        const f = Array.from(cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  return (
    <div className="ngx ngx-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div ref={cardRef} className={`ngx-modal is-${size}${tone === "danger" ? " is-danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ngx-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ngx-icon-btn" onClick={onClose} disabled={locked} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="ngx-modal-body">{children}</div>
        {footer && <footer className="ngx-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ── Misc ──────────────────────────────────────────────────────────────── */

export function initials(name: string): string {
  const parts = name.replace(/[@._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="ngx-empty">
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}

/* ── Confirm dialog (replaces window.confirm) ──────────────────────────── */

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
}

export function useConfirm() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const danger = state?.opts.tone === "danger";
  const dialog = state ? (
    <Modal
      size="sm"
      title={state.opts.title}
      tone={state.opts.tone}
      onClose={() => settle(false)}
      footer={
        <>
          <button type="button" className="ngx-btn is-secondary" onClick={() => settle(false)} data-autofocus={danger ? "" : undefined}>Cancel</button>
          <button type="button" className={`ngx-btn ${danger ? "is-danger-solid" : "is-primary"}`} onClick={() => settle(true)} data-autofocus={danger ? undefined : ""}>{state.opts.confirmLabel}</button>
        </>
      }
    >
      {state.opts.body}
    </Modal>
  ) : null;

  return { confirm, dialog };
}
