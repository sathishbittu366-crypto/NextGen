# SMS (CSD Student Management System) — Rebuild Spec

Status: authoritative build spec. Target: match SMS-17.2 (`webapp/`) exactly
in logic, permissions, data, and visual structure, delivered as a split
frontend (React/Vite SPA) + backend (FastAPI JSON API) instead of the
current server-rendered Jinja2+HTMX monolith.

This document assumes zero prior context. Every rule, route, field,
validation, and pixel-level layout decision needed to rebuild the system
is stated explicitly below. Where the source (SMS-17.2) contains a bug or
an intentionally-unfixed gap, that is stated explicitly too — replicate
the behavior as-is unless a section says otherwise.

No prose narrative, no history lesson beyond what's needed to disambiguate
a decision. If a rule seems arbitrary, it isn't — it is taken verbatim from
the reference implementation.

---

## 0. Source of truth and resolved decisions

Two prior codebases were used to produce this spec:

- **SMS-17.2** — the reference implementation. A FastAPI + Jinja2 + HTMX
  monolith. This is the exact logic, data model, and visual design to be
  reproduced. Treat everything in this document that isn't explicitly
  flagged "NEW" or "CHANGED FROM 17.2" as a literal port.
- **Sms-ReWrite** — a prior, partial attempt at the frontend/backend split
  this spec formalizes. It got Groups 1–3 (Auth, Dashboard, Attendance)
  backend-complete and live-tested, and Group 4 (Students) frontend-only.
  Its `OPTION_B_REWRITE_PLAN.md` is the architectural plan this spec
  continues and completes. Its code is reused where it is a faithful port
  (confirmed group-by-group below); where it drifted from SMS-17.2, this
  spec calls that out explicitly as a defect to fix, not a decision to keep.

The following decisions were open questions in the prior plan and are now
**resolved and final** for this build:

1. **Auth token carrier: resolved as Option 3a.** httpOnly refresh-token
   cookie (7-day expiry, matches the old session cookie's lifetime) +
   short-lived access token (15 min) held only in frontend memory (never
   localStorage/sessionStorage). Full mechanics in §5.
2. **Role removed from login — this is intentional and final.** SMS-17.2
   historically had, then removed, a role picker on the login form; the
   current SMS-17.2 login is username + password only, and
   `database.auth(username, password)` takes no role argument. **The
   rewrite must match this **exactly**.** The `Sms-ReWrite` copy in this
   drop had already drifted from this — its `database.py` added a `role`
   parameter to `auth()`, and its `webapp/routes/auth.py` /
   `api/routes_auth.py` added a role `<select>` to the login form and a
   `role` field to the login request body. **This drift must be reverted.**
   Login is username + password only. `auth(username, password)` — no role
   argument, in the backend, the API, and the frontend form. See §5.1 and
   §12 (discrepancy log) for the exact diff to undo.
3. **Attendance mutation behavior: resolved.** The five old
   mark/toggle/quick-mark/mark-all-present/save endpoints collapse to
   client-side-state-until-Save in the API version, exactly as
   `Sms-ReWrite`'s Group 3 already built it. `mark-all-present` remains a
   real (but non-writing) endpoint that returns a flipped roster shape;
   `save` is the only endpoint that writes to the database. See §8.
4. **Deployment topology: two fully separate processes.** The Jinja/HTMX
   app is retired entirely (not run alongside the new split app — SMS-17.2
   is the *behavioral* reference only, not a live parallel system). The
   new system is: one FastAPI process serving `/api/*` JSON only, and one
   static build of the React/Vite SPA served separately (dev: Vite dev
   server; prod: any static file host / same machine via nginx or
   `serve`). See §11.
5. **Visual refresh scope: none.** This is a transport rewrite only. Port
   `webapp/static/css/app.css`'s design tokens, layout, and component
   classes as CSS custom properties / plain CSS in the new frontend
   exactly. No new visual design, no component library reskinning, no
   Tailwind default theme. See §9.

---

## 1. What the system is

A single-department (CSD — Computer Science & Design) student management
system for one engineering college (VCET), covering three roles — **HOD**
(Head of Department), **FACULTY**, and **STUDENT** — through one
responsive web app. No cloud hosting requirement, no SaaS dependency, LAN
or tunnel-based reachability.

**Core principles (apply to every screen, every role):**

1. **One action, one path** — a row that can be edited has exactly one
   trigger for that, never two redundant interaction patterns for the same
   outcome.
2. **No decorative controls** — a control only renders if the *current
   role, right now* can actually use it. A locked attendance session shows
   no Edit control at all, not a disabled one. A nav item for a
   role/feature that doesn't apply is *absent*, not present-and-disabled
   (exception: pages not yet built during incremental rewrite — see §10.4
   — may render disabled with a "coming soon" affordance, but this must
   not ship as the final state).
3. **Hide complexity behind a tap, not a scroll** — default views show the
   smallest useful slice (e.g. the 15-day dashboard shows date +
   absent/present counts; the full roster is one tap further).
4. **Shared data, per-role/per-device rendered subset** — one API response
   shape backs HOD-on-laptop, faculty-on-phone, and
   student-checking-one-number; the frontend decides what subset to render
   per role and viewport, the backend does not fork logic by device.
5. **No visual polish beyond the ported design** — plain design, one
   accent color per semantic state (red = critical/absent, green =
   normal/present, amber = warning), no shadows/gradients/animation beyond
   what SMS-17.2 already has (the login screen's existing diagonal-split
   animation is the one exception — port it as-is, don't add more).
6. **Desktop is the anchor, mobile is derived** — desktop-width layout is
   the primary target; mobile is the same data/component adapted via CSS
   media queries, not a separately designed experience, except where
   SMS-17.2 already makes a deliberate mobile-specific choice (documented
   in §9).

---

## 2. Stack

### Backend
- **Framework:** FastAPI, JSON-only (no Jinja2, no server-rendered HTML,
  no HTMX).
- **Database:** SQLite, one file (`student_management.db`), schema in §4.
  Identical schema to SMS-17.2 — no columns added, removed, or renamed.
- **Business logic layer:** `sms_app/services/attendance_service.py`,
  `attendance_pdf.py`, `sms_service.py` — ported byte-for-byte unchanged
  from SMS-17.2. These modules already take plain arguments and return
  sqlite rows/plain values; they have no dependency on Jinja2 or the
  request/response cycle, so no logic changes are needed to reuse them
  under the new API routes. This is not optional: re-deriving this logic
  from scratch is explicitly out of scope and a regression risk (see
  `OPTION_B_REWRITE_PLAN.md §3.5`, carried forward as a hard constraint
  here).
- **Auth:** token-based (§5) — NOT the session cookie SMS-17.2 uses. This
  is the one deliberate architecture change the split requires; everything
  downstream of "who is logged in, what's their role, are they flagged for
  forced password change" must behave identically to SMS-17.2 regardless
  of the token mechanics.
- **Field encryption:** `field_encryption.py` — Fernet symmetric
  encryption for `students.aadhaar_number` and `students.apaar_id`.
  Ported unchanged.
- **PDF generation:** `reportlab`, via `attendance_pdf.py`, unchanged.
- **Image processing:** `Pillow`, via a ported `photo_upload.py`,
  unchanged validation/resize/encode behavior.
- **SMS:** `pyserial`, AT-command GSM modem driver + async polling worker,
  ported unchanged.
- **Password hashing:** PBKDF2-HMAC-SHA256, 200,000 rounds, per-password
  random salt. Ported unchanged.
- **Response envelope:** every `/api/*` route returns
  `{"data": ...}` on success or `{"error": {"message": "...", "code":
  "OPTIONAL_MACHINE_READABLE_CODE"}}` on failure. No bare JSON responses.
  See §6.

### Frontend
- **Framework:** React + Vite.
- **Routing:** React Router, one route per current page (mapping in §7).
- **State:** No Redux / heavy state library. `useState`/`useReducer` for
  local UI state (e.g. in-progress attendance register before Save); a
  thin fetch wrapper (§6.3) for server state — no React Query requirement,
  but acceptable if introduced consistently across all `api/*.ts` files.
- **Styling:** Plain CSS ported from `webapp/static/css/app.css` as CSS
  custom properties + component classes (§9). No Tailwind, no CSS-in-JS
  framework, no component library beyond what's already used.
- **HTTP:** one thin `apiFetch()` wrapper per §6.3; every API call goes
  through it, not raw `fetch()`.

### Dev/build tooling
- Backend: `uvicorn`, run via a `run_api.py` entry point.
- Frontend: Vite dev server (`npm run dev`) for development; `npm run
  build` produces a static bundle for production, served independently of
  the API process (see §11).

---

## 3. Roles and permissions matrix

Three roles, stored in `users.role`, CHECK-constrained to exactly these
three values (uppercase, always):

### STUDENT
The lightest-weight role. Built for "checking one number on a phone
between classes."
- **Home** (`/`): own attendance % per subject, color-coded (≥75% green /
  50–74% amber / <50% red). Tapping a subject drills into session-by-session
  present/absent history for that subject.
- Can edit own profile — every field except **roll number** and
  **department** (read-only identity/scope keys tied to login).
- Can upload/replace own profile photo.
- Can change own password.
- Can view the Academic Calendar (read-only, scoped to their
  `current_semester_id`).
- **Cannot**: see other students, mark attendance, see faculty teaching
  hours, see the audit log. No nav item exists for anything they can't do.

### FACULTY
Built for "standing in a corridor on a phone between periods."
- **Mark Attendance** (`/attendance`) is the default/primary screen: pick
  semester + subject (only subjects assigned to *them*) → pick Class
  (1/2/3 hr) or Lab (fixed 3 hr) → enter a mandatory topic → tap-mark
  present/absent (with "Mark all present") → Save.
- **My Sessions**: own 15-day session history + own computed teaching
  hours — never another faculty member's data. A session inside the
  24-hour edit window shows an Edit affordance; once locked, nothing extra
  renders.
- Can view/print the official attendance-register PDF for their own
  sessions anytime, even locked ones (printing is not editing).
- Can view (read-only) any student's profile — same route HOD uses, with
  Edit/Deactivate simply not rendered for this role.
- Has an own-account page (name/photo/password) — shared route+shape with
  HOD.

### HOD
The one role with a denser view, but still laptop-first with phone as
fallback.
- **Home = the 15-day attendance dashboard**: date → session rows →
  present-count pill (green, links to present-roster drill-down) /
  absent-count pill (red, links to absent-roster drill-down). A `?date=`
  query param switches to any single specific date instead of the rolling
  15-day window.
- **Faculty**: teaching-hours list per faculty member, a collapsed
  "Create Account" form, a collapsed subject-wise faculty view (inverse of
  teaching hours), and an Accounts table (activate/deactivate non-STUDENT
  accounts).
- **Subjects**: full subject CRUD per semester — create/edit subject,
  toggle subject active/inactive, toggle a whole semester active/inactive,
  assign/reassign faculty to a subject (many-to-many).
- **Students**: full roster CRUD — list (masked-Aadhaar column), add,
  edit, deactivate/reactivate, upload photo. The list's student name links
  to a **read-only detail view** first; Edit and Deactivate/Activate both
  live on *that* page, not directly off the list row.
- **Audit Log**: every FACULTY-actor action (attendance create/edit, topic
  changes, etc.) — HOD's own login/logout/status-toggle rows are filtered
  out of this *view* only (the underlying table still records everyone).
- **SMS Log**: read-only queue status (PENDING/SENT/FAILED) for the
  absentee-SMS feature.
- **Academic Calendar**: upload/replace the Timetable and Calendar
  (almanac) PDF per semester; the only role that can edit this page.
- Full edit access to any student's complete record and any subject's
  configuration, regardless of what a given faculty or student sees.

### Permission matrix (route-group level — exact route table in §7)

| Area | HOD | FACULTY | STUDENT |
|---|---|---|---|
| Dashboard/home | 15-day attendance view, all sessions | redirect hint to `/attendance` | own subject-wise % |
| Session present/absent drill-down | any session | own sessions only | — (no access) |
| Mark Attendance (setup + register + save) | any session, any faculty's session editable anytime | own sessions, editable only within 24h of creation | — (403) |
| Attendance PDF | any session, anytime | own sessions, anytime | — (403) |
| My Sessions | — (HOD uses main dashboard instead) | own only | — |
| Students list/view | full list, edit rights | read-only list/view | redirect to own profile |
| Students create/edit/toggle-status/photo | yes | no (403/redirect) | no |
| Faculty page (teaching hours, accounts) | yes | no | no |
| Subjects page (CRUD, semester toggle, assign faculty) | yes | no | no |
| Audit Log | yes | no | no |
| SMS Log | yes | no | no |
| Academic Calendar — view | yes (all active semesters) | yes (only semesters they teach in) | yes (only own `current_semester_id`) |
| Academic Calendar — upload | yes | no | no |
| Own account/profile view+edit | yes (shared HOD/FACULTY shape) | yes (shared HOD/FACULTY shape) | yes (student shape) |
| Own password change | yes | yes | yes |
| Own photo upload | yes | yes | yes |

---

## 4. Database schema (SQLite)

One file, `student_management.db`, created next to `database.py` on first
run via `init_db()`. Every schema change must be additive (`ALTER TABLE
... ADD COLUMN`, checked against `PRAGMA table_info()` first) so an
existing DB upgrades in place with zero data loss and zero manual
migration step. Every one-time data migration (below) is idempotent,
guarded by a row in `settings`, so a later admin edit is never silently
reverted by a future restart re-running `init_db()`.

`connect()` semantics: `sqlite3.connect(path, timeout=10)`,
`row_factory = sqlite3.Row`, `PRAGMA foreign_keys=ON`, `PRAGMA
busy_timeout=5000`, `PRAGMA journal_mode=DELETE` (no persistent WAL
side-file growth), `PRAGMA cache_size=-1024` (~1 MiB bounded page cache),
`PRAGMA temp_store=MEMORY`.

### 4.1 Tables

```sql
CREATE TABLE students(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'CSD' CHECK(department='CSD'),
    email TEXT UNIQUE COLLATE NOCASE,
    phone TEXT,
    parent_phone TEXT,
    dob TEXT,
    address TEXT,
    father_name TEXT,
    category TEXT,
    gender TEXT,
    seat_category TEXT,
    certificates_submitted TEXT,
    certificates_due TEXT,
    consultant_name TEXT,
    photo_path TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- additive columns (migrated in via ALTER TABLE, see §4.3):
    parent_phone TEXT,           -- duplicate name intentional: exists both
                                  -- in the CREATE TABLE and as a migration
                                  -- guard for pre-existing DB files
    aadhaar_number TEXT,         -- Fernet-encrypted at rest, see §4.4
    apaar_id TEXT,               -- Fernet-encrypted at rest, see §4.4
    tenth_school TEXT, tenth_year TEXT, tenth_marks TEXT,
    tenth_certificate_path TEXT, -- unused going forward, kept for safety (§4.5)
    twelfth_school TEXT, twelfth_year TEXT, twelfth_marks TEXT,
    twelfth_certificate_path TEXT, -- unused going forward, kept for safety
    diploma_college TEXT, diploma_year TEXT, diploma_marks TEXT,
    diploma_certificate_path TEXT, -- unused going forward, kept for safety
    current_semester_id INTEGER REFERENCES academic_semesters(id)
);

CREATE TABLE users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password TEXT NOT NULL,               -- pbkdf2_sha256$rounds$salt_hex$digest_hex
    role TEXT NOT NULL CHECK(role IN ('HOD','FACULTY','STUDENT')),
    student_roll_no TEXT UNIQUE,          -- NULL for HOD/FACULTY
    full_name TEXT NOT NULL DEFAULT '',
    photo_path TEXT,
    department TEXT,
    designation TEXT,
    employee_id TEXT,
    email TEXT,
    phone TEXT,
    qualification TEXT,
    date_of_joining TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE attendance(   -- legacy/simple daily attendance; superseded by
                            -- attendance_sessions/attendance_records below
                            -- but the table is NOT dropped — keep it.
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL,
    date TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'CSD',
    status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Excused')),
    marked_by TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(roll_no,date),
    FOREIGN KEY(roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE marks(        -- legacy; pre-dates the deferred "P4" results
                            -- engine (§13.2) — keep the table, no active
                            -- route in this spec writes to it.
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL,
    subject TEXT NOT NULL,
    internal REAL NOT NULL DEFAULT 0 CHECK(internal BETWEEN 0 AND 100),
    external REAL NOT NULL DEFAULT 0 CHECK(external BETWEEN 0 AND 100),
    entered_by TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(roll_no,subject),
    FOREIGN KEY(roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE checklist(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Complete','Available','Not Applicable')),
    UNIQUE(roll_no,item),
    FOREIGN KEY(roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE audit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_semesters(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE subjects(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    has_lab INTEGER NOT NULL DEFAULT 0 CHECK(has_lab IN (0,1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    UNIQUE(semester_id,code),
    FOREIGN KEY(semester_id) REFERENCES academic_semesters(id) ON DELETE CASCADE
);

CREATE TABLE subject_faculty(
    subject_id INTEGER NOT NULL,
    faculty_username TEXT NOT NULL,
    PRIMARY KEY(subject_id,faculty_username),
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(faculty_username) REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE attendance_sessions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attendance_date TEXT NOT NULL,
    semester_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    faculty_username TEXT NOT NULL,
    session_type TEXT NOT NULL CHECK(session_type IN ('CLASS','LAB')),
    duration_hours INTEGER NOT NULL CHECK(duration_hours IN (1,2,3)),
    topic TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(attendance_date,subject_id,faculty_username,session_type),
    FOREIGN KEY(semester_id) REFERENCES academic_semesters(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(faculty_username) REFERENCES users(username) ON UPDATE CASCADE
);

CREATE TABLE attendance_records(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    roll_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present','Absent')),
    marked_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id,roll_no),
    FOREIGN KEY(session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE sms_queue(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    attendance_session_id INTEGER,
    send_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,
    error TEXT,
    UNIQUE(roll_no,send_date),
    FOREIGN KEY(roll_no) REFERENCES students(roll_no) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions(id)
);

CREATE TABLE academic_calendar(
    semester_id INTEGER PRIMARY KEY,
    timetable_path TEXT,
    timetable_updated_at TEXT,
    timetable_updated_by TEXT,
    calendar_path TEXT,
    calendar_updated_at TEXT,
    calendar_updated_by TEXT,
    FOREIGN KEY(semester_id) REFERENCES academic_semesters(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_attendance_sessions_date ON attendance_sessions(attendance_date);
CREATE INDEX idx_attendance_sessions_subject ON attendance_sessions(subject_id);
CREATE INDEX idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_roll ON attendance_records(roll_no);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_date_roll ON attendance(date, roll_no);
CREATE INDEX idx_attendance_roll ON attendance(roll_no);
CREATE INDEX idx_marks_roll ON marks(roll_no);
CREATE INDEX idx_students_department ON students(department);
CREATE INDEX idx_sms_queue_status ON sms_queue(status);
CREATE INDEX idx_sms_queue_date ON sms_queue(send_date);
```

All foreign keys to `students.roll_no` and `users.username` cascade on
UPDATE; `students` FKs also cascade on DELETE (in practice students are
deactivated, never deleted).

### 4.2 Table purpose summary

| Table | Purpose | Notable constraints |
|---|---|---|
| `students` | One row per student | `roll_no UNIQUE COLLATE NOCASE`, `department` locked to `'CSD'`, `active` soft-delete flag |
| `users` | Login accounts, all three roles | `role` CHECK, `student_roll_no` FK (NULL for HOD/FACULTY), `username UNIQUE COLLATE NOCASE` |
| `attendance` | Legacy/simple daily attendance | `UNIQUE(roll_no, date)` — not written to by any active route |
| `attendance_sessions` | One row per (date, subject, faculty, type) teaching event | `UNIQUE(attendance_date, subject_id, faculty_username, session_type)` — idempotent session identity |
| `attendance_records` | One row per (session, student) mark | `UNIQUE(session_id, roll_no)` |
| `marks` | Legacy; pre-dates deferred Results engine | not written to by any active route |
| `checklist` | Per-student onboarding checklist | `UNIQUE(roll_no, item)` |
| `settings` | Key-value app config + migration guards | `key` is PRIMARY KEY |
| `audit_logs` | Append-only action log | no constraints beyond NOT NULL |
| `academic_semesters` | The 8 semester rows | `code UNIQUE`, `sort_order UNIQUE` |
| `subjects` | Subjects per semester | `UNIQUE(semester_id, code)` |
| `subject_faculty` | M:N subject↔faculty | composite PK |
| `sms_queue` | Absentee-SMS send queue | `UNIQUE(roll_no, send_date)` — one alert/student/day |
| `academic_calendar` | Per-semester Timetable + Calendar PDF paths | `semester_id` is PRIMARY KEY |

### 4.3 Migration behavior required on every `init_db()` call

Must run, in order, every time the app starts (not just on first run):

1. `CREATE TABLE IF NOT EXISTS` for every table above.
2. For `students`: check `PRAGMA table_info(students)` and `ALTER TABLE
   students ADD COLUMN ...` for any of `parent_phone`, `photo_path`,
   `aadhaar_number`, `apaar_id`, `tenth_school`, `tenth_year`,
   `tenth_certificate_path`, `twelfth_school`, `twelfth_year`,
   `twelfth_certificate_path`, `diploma_college`, `diploma_year`,
   `diploma_certificate_path`, `tenth_marks`, `twelfth_marks`,
   `diploma_marks`, `current_semester_id` not already present.
3. For `users`: same pattern for `photo_path`, `department`,
   `designation`, `employee_id`, `email`, `phone`, `qualification`,
   `date_of_joining`, `must_change_password`.
4. Seed all 62 real CSD students from the immutable roster tuple
   (`seed_data.py`, §4.6) via `INSERT ... ON CONFLICT(roll_no) DO UPDATE`
   (idempotent upsert, not insert-or-ignore — re-running must refresh
   name/phone/dob/etc. from the seed if changed, while leaving
   HOD-editable-only fields like `aadhaar_number` alone since the seed
   tuple doesn't carry them). Seed each student's onboarding `checklist`
   rows via `INSERT OR IGNORE`. Ensure a STUDENT login exists for each
   seeded roll number (username = `roll_no.lower()`, password =
   `roll_no + '@CSD'`, `must_change_password=1`) if none exists yet.
5. Seed two default staff accounts if missing: `admin` / `admin123` (HOD,
   full_name "CSD Head of Department") and `faculty` / `faculty123`
   (FACULTY, full_name "CSD Faculty"). Backfill `department`/`designation`
   for these two if NULL.
6. Upgrade any legacy plaintext-stored password to the `pbkdf2_sha256$...`
   format (check `str.startswith("pbkdf2_sha256$")`, re-hash if not).
7. Seed default `settings` rows via `INSERT OR IGNORE`: `institution_name`
   = "VCET CSD Student Management System", `attendance_threshold` = "75",
   `academic_year` = "2024-25", `department` = "CSD", `sms_enabled` = "0",
   `sms_modem_port` = "/dev/ttyUSB0", `sms_modem_baud` = "115200",
   `sms_daily_cap` = "62".
8. Seed 8 semesters via `INSERT OR IGNORE`: `I-I`/"I Year - I
   Semester"/sort 1, `I-II`/"I Year - II Semester"/sort 2, `II-I`/sort 3,
   `II-II`/sort 4, `III-I`/sort 5, `III-II`/sort 6, `IV-I`/sort 7,
   `IV-II`/sort 8. **I-I and I-II are seeded `active=0`**; all others
   `active=1`.
9. One-time guarded migration (`settings` key
   `migrated_deactivate_year1`): force `academic_semesters.active=0` for
   codes `I-I`/`I-II` on any pre-existing DB where `INSERT OR IGNORE`
   above no-op'd on already-present active rows. Runs exactly once.
10. Seed the generic demo semester content under `II-II`: 6 subjects
    (`Data Structures`, `Database Systems`, `Operating Systems`,
    `Computer Networks`, `Software Engineering`, `Web Technologies`),
    codes `CSD221`–`CSD226`, `has_lab=1` for `Database Systems` and `Web
    Technologies` only. Assign all of them to the first active FACULTY
    account found (by `id ASC`), via `INSERT OR IGNORE` into
    `subject_faculty`.
11. Seed the real III-I semester content (the actual current cohort, not
    demo data):
    - 7 subjects under `III-I`: `24CS501PC` "Algorithms Design and
      Analysis" (has_lab=1), `24CS502PC` "Computer Networks" (has_lab=1),
      `24CS503PC` "Introduction to Data Science" (has_lab=1),
      `24CS522PE` "Software Project Management" (has_lab=0), `24CS512PE`
      "Artificial Intelligence" (has_lab=0), `24MC510` "Intellectual
      Property Rights" (has_lab=0), `24CS508PC` "Advanced English
      Communication Skills Laboratory" (has_lab=1).
    - 4 real named FACULTY accounts (see §4.7 for exact usernames/
      passwords): `k.srikanth`, `sv.subramanyam`, `k.divya`,
      `k.pranushareddy` — created via `INSERT ... IF NOT EXISTS` on
      `username`, department `CSD`, designation `Faculty`.
    - Assign faculty to subjects: `24CS501PC`→`k.srikanth`,
      `24CS502PC`→`sv.subramanyam`, `24CS503PC`→`k.divya`,
      `24CS522PE`→`k.pranushareddy`. **`24CS512PE` (AI), `24MC510` (IPR),
      and `24CS508PC` (AECS Lab) are intentionally left with no faculty
      assigned** — the source timetable's legend named none. Do not
      guess an assignment.
    - Guarded migration (`settings` key
      `migrated_iii_i_current_semester`): set every seeded CSD student's
      `current_semester_id` to `III-I`'s id. Runs exactly once.
    - Guarded migration (`settings` key `migrated_iii_i_timetable_doc`):
      if a file matching `iii-i-timetable-*.pdf` exists under the
      uploads' `academic_calendar` subdirectory, register it as `III-I`'s
      `timetable_path` via upsert into `academic_calendar`. Runs exactly
      once.
    - Guarded migration (`settings` key `migrated_iii_i_calendar_doc`):
      same pattern for `iii-i-calendar-*.pdf` → `calendar_path`. Separate
      guard from the timetable one so replacing just one document later
      doesn't retrigger the other.
12. Field-encryption catch-up (runs **every** startup, not guarded by a
    one-shot settings flag — see rationale in §4.4): for every
    `students.aadhaar_number` / `students.apaar_id` value that is
    non-null/non-empty and fails `looks_encrypted()`, encrypt it in place.

### 4.4 Field encryption (Aadhaar / APAAR)

`field_encryption.py` — Fernet symmetric encryption, one module owns the
key, cipher, and "is this already ciphertext" heuristic. Every call site
imports `encrypt_field` / `decrypt_field` / `looks_encrypted` from here;
no other module re-derives this logic.

- **Key source:** environment variable `SMS_FIELD_ENCRYPTION_KEY`. **Hard
  failure at first use if unset** — raise `RuntimeError` with a clear
  message pointing at deployment docs. Do not silently generate or
  default this key; that would make already-encrypted values from a prior
  run permanently unrecoverable the moment the key changes.
- `looks_encrypted(value)`: returns `False` for falsy input; otherwise
  attempts `Fernet(key).decrypt(value.encode())` and returns `True`/`False`
  based on whether that succeeds (catching `InvalidToken`, `ValueError`,
  `TypeError`). A Fernet token is urlsafe-base64 and always far longer
  than any realistic plaintext this app stores, so this heuristic has no
  ambiguous middle ground for this app's data shapes.
- `encrypt_field(plaintext)`: `None`/`''` pass through unchanged (never
  encrypt an empty value — that would turn "not provided" into a
  non-empty ciphertext blob and break every falsy check downstream).
  Otherwise `Fernet(key).encrypt(plaintext.encode()).decode()`.
- `decrypt_field(ciphertext)`: `None`/`''` pass through unchanged.
  Otherwise `Fernet(key).decrypt(ciphertext.encode()).decode()`. Let
  `InvalidToken` propagate on bad input — do not swallow it silently;
  swallowing it is exactly the historical corruption-trap bug class (see
  next paragraph).
- **Corruption trap — must be prevented at every read/write site
  touching `aadhaar_number`/`apaar_id`:** any code path that renders these
  fields into an editable form (edit-student form, create-student
  fallback-on-error re-render) MUST decrypt first. If a decrypt is
  skipped, ciphertext lands in the form's value attribute; if the user
  submits without touching that field (likely, among ~20 fields), the
  save path re-encrypts the ciphertext-as-if-plaintext and **permanently
  destroys the real value with no error thrown.** `validate_student()`'s
  12-digit check is a safety net for `aadhaar_number` specifically (a
  Fernet token is never exactly 12 digits) — keep that validation
  regardless, but do not rely on it as the only protection; `apaar_id` has
  no format check and depends entirely on decrypt-before-render being
  correct.
- **Why the startup catch-up migration (§4.3 step 12) is NOT guarded by a
  one-shot settings flag** unlike the other seed migrations: HOD can add
  a new plaintext Aadhaar via the normal edit form at any time after this
  feature shipped, and that value must be encrypted on save (the route
  layer already does this) but must never be touched again by this
  startup migration once encrypted. A one-shot flag would either skip a
  value added the day after the flag was set (leaving it unencrypted
  forever) or need re-triggering logic that risks double-encrypting an
  already-encrypted value. Testing every value against `looks_encrypted`
  on every startup is what stays correct in both directions — cheap
  no-op on already-encrypted values, catches anything still plaintext
  regardless of when it was written.
- **Masking** (`mask_aadhaar(value)`, in `database.py`, NOT in
  `field_encryption.py`): given a decrypted plaintext value, strips
  whitespace, and returns `"XXXX XXXX {last 4 digits}"` if exactly 12
  digits; `"—"` if empty; `"XXXX XXXX XXXX"` if non-empty but not exactly
  12 digits. **Applied everywhere except the HOD detail/edit view**, which
  shows the full decrypted number. Never write the unmasked value into
  attendance PDFs or audit-log `details` text — confirmed at the code
  level that neither `attendance_pdf.py` nor any `audit()` call touching
  students references `aadhaar_number`.

### 4.5 Certificate upload — explicitly halted, not implemented

`tenth_certificate_path` / `twelfth_certificate_path` /
`diploma_certificate_path` columns and a `save_certificate()` helper exist
in the schema/codebase but certificate upload is **intentionally
disabled** (an explicit product decision: upload-handling wasn't hardened
enough at this app's stage). Any certificate-upload endpoint must exist
as a route that accepts the request and returns success/redirect
**without writing to disk or the database** — dead code kept for
backward-compatibility with anything that might still call it, not a bug
to "fix" by re-enabling it. Marks entry
(`tenth_marks`/`twelfth_marks`/`diploma_marks`, free-text numeric strings
0–100) is the shipped replacement — edited via the same student edit
form as every other field.

### 4.6 Seed roster

`seed_data.py` exports `CSD_STUDENTS`, an immutable Python list of 62
tuples: `(roll_no, name, father_name, dob, category, gender,
seat_category, certificates_submitted, certificates_due, consultant_name,
phone)`. Roll numbers follow the pattern `24BT1A67xx` (01–62). This is
real production data (real names, real phone numbers) — treat the exact
tuple contents as fixed input data to seed, not to regenerate or alter.
Copy this file byte-for-byte from the reference implementation rather
than re-deriving it.

### 4.7 Default accounts (seed data — must match exactly)

| Role | Username | Password | Notes |
|---|---|---|---|
| HOD | `admin` | `admin123` | Generic demo HOD account |
| FACULTY | `faculty` | `faculty123` | Generic demo faculty (no real subject assignment) |
| FACULTY | `k.srikanth` | `srikanth123` | Real — teaches ADA (`24CS501PC`) |
| FACULTY | `sv.subramanyam` | `subramanyam123` | Real — teaches CN (`24CS502PC`) |
| FACULTY | `k.divya` | `divya123` | Real — teaches IDS (`24CS503PC`) |
| FACULTY | `k.pranushareddy` | `pranusha123` | Real — teaches SPM (`24CS522PE`) |
| STUDENT | `<roll_no>.lower()` | `<ROLL_NO>@CSD` | One per seeded student (62 total); `must_change_password=1` |

---

## 5. Auth (token mechanics)

Reference session model (`webapp/auth_session.py` + `webapp/config.py`):
one httpOnly cookie `sms_session`, itsdangerous-signed (`SECRET_KEY`, salt
`sms-session`), 7-day max age, payload `{username, role, student_roll_no,
must_change_password}`. `SECRET_KEY` comes from env `SMS_SECRET_KEY`; both
`run_web.py` and the new `run_api.py` **hard-refuse to start** if it's
unset (`sys.exit(1)` with a message pointing at `DEPLOY.md`) — never fall
back to a generated/default key, since that would let anyone forge a
valid HOD session. This is a literal port to the new system, not a
relaxation: `run_api.py` performs the identical check.

The new split system replaces that single cookie with two tokens (resolved
in §0.1 as Option 3a). Both are itsdangerous `URLSafeTimedSerializer`
instances keyed off the same `SECRET_KEY` — two serializers with different
salts/max_ages, not a second crypto scheme:

| Token | Salt | Max age | Carrier | Read by |
|---|---|---|---|---|
| Access | `sms-api-access` | 15 min (900s) | JSON body → held in a JS variable only, sent as `Authorization: Bearer <token>` | every `/api/*` route via `get_current_user` |
| Refresh | `sms-api-refresh` | 7 days (matches old `SESSION_MAX_AGE`) | httpOnly, `secure` (see below), `samesite=lax` cookie, name `sms_refresh`, `path=/api/auth` | only `POST /api/auth/refresh` |

Payload shape, identical for both tokens: `{username, role,
student_roll_no, must_change_password}`.

**Never localStorage/sessionStorage for the access token** — this app
handles Aadhaar/APAAR fields; anything in browser storage is readable by
an injected script. The access token lives only in a module-level JS
variable (`frontend/src/api/client.ts`'s `accessToken`), lost on a hard
refresh, restored via silent `POST /api/auth/refresh` on app mount (the
refresh cookie survives a refresh; see §10.3).

**`must_change_password` is embedded in BOTH tokens, not derived only
from a DB check on the access token.** `get_current_user` only ever
decodes the access token — the refresh token is opaque to every other
route — so if the flag lived only in the refresh token, a flagged user's
access token would omit it and the gate would fail open. Re-embedded on
every `/api/auth/refresh` call (re-queried from `users.must_change_password`
at refresh time, not just carried over from the old token's payload) so a
HOD manually clearing someone's flag server-side takes effect on that
user's very next silent refresh, not just their next full login.

**Refresh cookie `secure` flag:** `os.environ.get("SMS_ENV",
"development") == "production"`. Plain-HTTP local dev (Vite on
`localhost:5173` → API on `localhost:8001`, no TLS) needs `secure=False`
or the browser silently refuses to store the cookie at all — not a
partial failure, the entire refresh flow breaks with no visible error.
Every real deployment **must** set `SMS_ENV=production` (→
`secure=True`) **and** actually serve over HTTPS — setting the env var
without HTTPS makes the browser refuse the cookie for the opposite
reason.

**Cookie path scoping:** `path=/api/auth` deliberately, not `/`. The
refresh cookie is only ever needed by `/api/auth/refresh`; scoping it
narrower means it isn't sent on every request to every route.

**CORS:** `allow_origins` must be an explicit list (`http://localhost:5173`,
`http://127.0.0.1:5173` for dev; the real frontend origin(s) in
production), never `"*"` — `allow_credentials=True` (required because the
refresh cookie needs `credentials:'include'` on every frontend fetch) is
invalid together with a wildcard origin per the CORS spec.

**FastAPI response gotcha (already bitten the rewrite once, live-tested,
keep this pattern):** every route that needs to set the refresh cookie
must call `ok(...)` first, capture the returned `JSONResponse`, then call
`.set_cookie()`/`.delete_cookie()` on *that* object and return it — not
on a separately `Depends`-injected `Response` parameter. FastAPI only
merges an injected `Response`'s headers/cookies onto a plain dict/model
return value; a handler returning its own `JSONResponse` bypasses that
merge, so `response.set_cookie()` on the injected parameter is silently
dropped. Confirmed the hard way in Group 1's live test (refresh cookie
never arrived at the browser).

### 5.1 Routes

All under `/api/auth`, no trailing slash. `CurrentUser` = `{username,
role, student_roll_no, must_change_password}` — mirrors
`webapp/auth_session.py`'s `CurrentUser` field-for-field so the reused
service-layer functions don't need to change shape.

| Route | Auth | Body | Notes |
|---|---|---|---|
| `POST /api/auth/login` | none | `{username, password}` | **No `role` field — see below.** Rate-limited (§5.2). |
| `POST /api/auth/refresh` | refresh cookie | none | Re-checks `must_change_password` against the DB. Reissues both tokens (sliding 7-day window). |
| `POST /api/auth/logout` | access token (allow-pending) | none | Audits `LOGOUT`, clears the refresh cookie. |
| `GET /api/auth/me` | access token (allow-pending) | — | Used by the frontend's route guard on mount; must NOT 403 a flagged user, or the guard can never learn `must_change_password` is set. |
| `POST /api/auth/change-password` | access token (allow-pending) | `{old_password, new_password, confirm_password}` | The only mutating route reachable while `must_change_password=1`. |

**`POST /api/auth/login` — username + password only, no `role` field, no
`role` argument anywhere in the call chain.** `auth(username, password)`
in `database.py` takes exactly two parameters and looks the user up by
username alone (`SELECT * FROM users WHERE username=? COLLATE NOCASE AND
active=1`), then verifies the password hash — role is read *off the
found row*, never supplied by the caller as a filter. This is a direct,
intentional port of the current SMS-17.2 behavior (the login form used
to have a role picker; it was removed) and is **resolved and final** per
§0.2. `LoginBody` must be `{username: str, password: str}` — no `role`
field. See §12 for the exact prior drift this corrects.

On success: `{access_token, expires_in: 900, user: {username, role,
student_roll_no, must_change_password}, redirect}`. `redirect` is
`/force-password-change` if flagged, else role-mapped destination (§5.3).
Also sets the refresh cookie and calls `audit(c, username, "LOGIN",
"session", role)` — same audit call as the reference.

On failure: `401 INVALID_CREDENTIALS`, message `"Invalid credentials or
inactive account"` (drop "or role" from the message — there is no role
input to be wrong about). Missing username/password: `400
MISSING_CREDENTIALS`.

`POST /api/auth/change-password`: `new_password != confirm_password` →
`400 PASSWORD_MISMATCH`. Otherwise calls `change_password(username,
old_password, new_password)` unchanged from the reference (≥8 chars,
verifies `old_password` against the stored hash, clears
`must_change_password` unconditionally as a side effect — this is the
single function every password-change path in the app calls, self-service
and forced-reset alike). `ValueError` → `400 PASSWORD_CHANGE_FAILED`.
Audits `FORCED_PASSWORD_CHANGE` if the user was flagged, else
`CHANGE_PASSWORD`. On success, reissues both tokens with
`must_change_password=False` baked in (the DB flag is already cleared,
but this request's *existing* tokens are the old signed payloads with the
flag still `True` — without reissuing, the frontend holds a stale
flagged token until the next refresh cycle) and returns `{access_token,
expires_in, redirect}`.

### 5.2 Rate limiting (`api/rate_limit.py`)

In-memory, keyed by caller-supplied string. 5 attempts / 15-minute window
(`MAX_ATTEMPTS=5`, `WINDOW_SECONDS=900`). `POST /api/auth/login` keys by
`f"{client_ip}:{username.strip().lower()}"` — **IP+username, not username
alone** — a username-only key lets an attacker lock out a real user by
deliberately failing their username from a different IP; that's itself a
denial-of-service vector against legitimate users. `record_success`
clears the key entirely (a legitimate login after some typos shouldn't
sit in a countdown toward lockout). Locked → `429 RATE_LIMITED`, generic
message `"Too many attempts. Try again later."` — **never distinguish
"locked out" from "wrong credentials"** in the response; a lockout-specific
message confirms the username exists and has real attempts against it,
which is exactly the username-enumeration vector this exists to prevent.

In-memory and single-process by design (matches the "two fully separate
processes, not a worker fleet" deployment topology in §0.4/§11) — if this
ever runs behind multiple worker processes, the limiter state needs to
move to shared storage; that is explicitly not built here.

The same limiter (fresh key scheme, not shared state) is reused for
`GET /api/files/{subdir}/{filename}` once that group is built (§7.7) —
built once here, applied twice.

### 5.3 Role-based redirect table

Duplicated intentionally in two places, not shared by import — they
encode different things (Jinja URL paths vs. React route paths) even
though the role→destination logic is identical:

```
FACULTY → /account
HOD     → /account
STUDENT → /profile
```

(Old Jinja equivalent was `/me/account` / `/me/profile` — the new
frontend's route names are shorter since `/me/*` was a Jinja-side
namespacing convention with no equivalent requirement in a client-routed
SPA. Not a discrepancy, just new route names for a new router — see §12
if this ever needs re-litigating.)

### 5.4 Dependencies (`api/deps.py`)

Two FastAPI dependency functions, both reading `Authorization: Bearer
<token>`:

- **`get_current_user`** — the equivalent of the reference's
  `get_current_user()` reading the session cookie. Missing/malformed
  header → `401 NOT_AUTHENTICATED`. Invalid/expired token → `401
  TOKEN_INVALID`. **If `must_change_password` is set on the decoded
  token → `403 MUST_CHANGE_PASSWORD`** (not 401 — the token itself is
  valid, the caller is authenticated, they're just gated from everything
  except the two routes below until they clear the flag; 401 would
  incorrectly trigger a re-login loop on the frontend instead of routing
  to the change-password screen).
- **`get_current_user_allow_pending`** — identical decode/401 handling,
  but never raises `MUST_CHANGE_PASSWORD`. Used only by `POST
  /api/auth/change-password`, `POST /api/auth/logout`, and `GET
  /api/auth/me` — the three routes that must stay reachable while
  flagged. Mirrors the reference's `/force-password-change` route
  reading `read_session()` directly instead of depending on
  `get_current_user()`, for the identical reason: depending on the
  strict version on the one route meant to clear the flag would 403-loop
  forever.

Every other route in the API depends on the strict `get_current_user`.

---

## 6. Response envelope and error handling (`api/envelope.py`)

Every `/api/*` route returns exactly one of two shapes — never bare JSON,
never FastAPI's default `{"detail": "..."}`:

```json
// success
{ "data": { ... } }

// error
{ "error": { "message": "...", "code": "OPTIONAL_MACHINE_READABLE_CODE" } }
```

**Why:** the frontend's `apiFetch()` wrapper checks for `error` uniformly
instead of every call site guessing whether a 4xx body is FastAPI's
default shape or something else. One shape everywhere is a hard rule, not
a preference — a route that returns bare JSON breaks the frontend's error
handling silently (it'll treat a well-formed error as a malformed success
and vice versa).

- `ok(data, status_code=200)` → wraps `data` in `{"data": ...}` via
  `jsonable_encoder`, returns a `JSONResponse`. Every route builds its
  success response through this, not by returning a raw dict (FastAPI
  would still wrap a raw dict in `{"data": ...}` if the route return type
  were annotated that way, but this codebase does it explicitly so cookie
  operations have a concrete `JSONResponse` to call `.set_cookie()` on —
  see §5's FastAPI response gotcha).
- `ApiError(message, status_code=400, code=None)` — subclasses
  `HTTPException`. Raise this (not a bare `HTTPException`) from any route
  or dependency that needs a specific `code` in the error body. A bare
  `HTTPException` is still caught and enveloped, just without a `code`
  field.
- Three exception handlers, registered on the app in `api/app.py`:
  `api_error_handler` (catches `ApiError` → envelope with `code`),
  `http_exception_handler` (catches any other `HTTPException`, e.g.
  FastAPI's own 404 on an unmatched route → envelope, `detail` string
  only, no `code`), `unhandled_exception_handler` (last-resort catch-all
  for any uncaught `Exception` → logs the full traceback server-side via
  `logging.getLogger("sms.api").exception(...)`, returns a generic
  `{"error": {"message": "Internal server error"}}` with **no traceback
  or exception text ever sent to the client**). This is
  `SECURITY_HANDOFF.md` item #3 ("no catch-all exception handler"),
  built once, correctly, from the start rather than retrofitted.

---

## 7. API route inventory — all groups

Route mapping follows one pattern throughout: old Jinja render/redirect →
new JSON. GET routes that used to render a page now return the page's
full data payload in one call (no more separate partial/fragment
endpoints for what a single React component can hold as state). POST
routes that used to redirect (303) now return `{data: {...}}` or throw an
`ApiError`; the frontend's router — not the server — decides where to
navigate next.

Every mutating route (auth aside) depends on `get_current_user` (the
strict dependency — a `must_change_password`-flagged token 403s before
reaching the handler). Every route additionally does its own role check
in the handler body — **never rely on the URL/router shape alone to
restrict access**; see §8's `_require_staff` for the canonical pattern
and the CRITICAL red-team history behind it.

Status markers below: **[BUILT]** = implemented and live-tested in
`Sms-ReWrite`, reuse as-is (verify against §12 first for Group 1's
`role`-field defect). **[SPEC ONLY]** = not yet implemented; the route
shape below is this document's authoritative spec for building it,
derived directly from the SMS-17.2 reference route in the given file —
build these as new `api/routes_*.py` modules following the same
`_serialize_*`/`ApiError`/`ok()` pattern as the built groups.

### 7.1 Auth — `/api/auth/*` — **[BUILT, with §12 defect to fix]**

See §5.1. Source: `webapp/routes/auth.py`.

### 7.2 Dashboard — `/api/dashboard/*` — **[BUILT]**

Source: `webapp/routes/dashboard.py`, service layer
`sms_app/services/attendance_service.py`.

| Route | Role | Response |
|---|---|---|
| `GET /api/dashboard?date=YYYY-MM-DD` | any | Role-branches: HOD → `{role, days: {date: [session...]}, picked_date}` (15-day or single-date session list, grouped); FACULTY → `{role, redirect: "/attendance"}` (frontend navigates there, no session data fetched here); STUDENT → `{role, student: {roll_no, name, department}, subjects: [{subject_id, code, name, pct, band, total, present}]}` |
| `GET /api/dashboard/session/{id}/present` | HOD, FACULTY | `{session: {...}, students: [{roll_no, name}], kind: "present"}` |
| `GET /api/dashboard/session/{id}/absent` | HOD, FACULTY | Same shape, `kind: "absent"` |
| `GET /api/dashboard/student/subject/{subject_id}/history` | STUDENT (own record only) | `{subject_id, sessions: [{attendance_date, session_type, duration_hours, status}]}` |

STUDENT role calling the session present/absent routes, or non-STUDENT
calling the subject-history route → `403 FORBIDDEN`. A STUDENT account
with no matching `students` row → `404 STUDENT_NOT_FOUND`.

### 7.3 Attendance — `/api/attendance/*` — **[BUILT]**

Full detail in §8 (highest-complexity group, gets its own section per the
original build-order plan). Source: `webapp/routes/attendance.py`,
services `attendance_service.py` + `attendance_pdf.py` + `sms_service.py`.

### 7.4 Students — `/api/students/*` — **[SPEC ONLY]**

Source: `webapp/routes/students.py`. Frontend pages already exist
(`StudentsListPage.tsx`, `StudentFormPage.tsx`, `StudentViewPage.tsx`) and
already call through `frontend/src/api/students.ts`, whose contract below
is what the not-yet-built backend must satisfy exactly — do not redesign
the response shapes, the frontend already assumes them.

| Route | Role | Request | Response |
|---|---|---|---|
| `GET /api/students?q=&status=Active\|Inactive\|All` | HOD, FACULTY | — | `StudentListRow[]`: `{id, roll_no, name, email, phone, aadhaar_masked, active}` per row. STUDENT role → redirect-equivalent; frontend never routes STUDENT here (App.tsx already guards `/students` this way), but the backend must still 403 STUDENT defensively. |
| `GET /api/students/{id}` | HOD, FACULTY | — | `{student: StudentRecord, semester: {code, name} \| null}`. `aadhaar_number`/`apaar_id` returned **decrypted** (this is the HOD-detail-view exception to masking, §4.4) |
| `GET /api/students/new` | HOD only | — | `{student: null, semesters: SemesterOption[]}` — form-scaffolding data for the create form |
| `GET /api/students/{id}/edit` | HOD only | — | `{student: StudentRecord, semesters: SemesterOption[]}` — `aadhaar_number`/`apaar_id` **must be decrypted** here; this is the corruption-trap site named in §4.4 — decrypt before ever putting the value in a JSON response the edit form will pre-fill and possibly round-trip unchanged |
| `POST /api/students` | HOD only | every `FIELD_SPECS` + `EDUCATION_SPECS` key (string, may be empty) + `current_semester_id` | `{id, created_credentials: {username, password} \| null}` — `created_credentials` is always non-null on create (mirrors `ensure_student_login()` always firing on new-student creation) |
| `PATCH /api/students/{id}` | HOD only | same body shape as POST | `{id, created_credentials: null}` — never creates a login on update |
| `POST /api/students/{id}/toggle-status` | HOD only | — | `{active: bool}` |
| `POST /api/students/{id}/photo` | HOD only | multipart, field `photo` | `{photo_path}` — via `save_profile_photo(subdir="students", stem=roll_no)`, §7.6 |

**Validation (`validate_student(data)`, `database.py`) — port unchanged:**
`roll_no`/`name`/`department` required; `department` must be in
`DEPARTMENTS` (i.e. `"CSD"` — this system is CSD-only, reject anything
else); `email` if present must match `[^\s@]+@[^\s@]+\.[^\s@]+`; `phone`
and `parent_phone` if present, after stripping `[\s+()-]`, must be 7–15
digits; `aadhaar_number` if present, after stripping whitespace, must be
exactly 12 digits; `tenth_marks`/`twelfth_marks`/`diploma_marks` if
present must parse as a float in `[0, 100]`. `dob` if present must parse
as `YYYY-MM-DD` (`datetime.strptime`) — this check happens in the route,
not inside `validate_student`. On any `ValueError` → `400
VALIDATION_ERROR` with the exact message from the reference (these
messages are user-facing and title-cased per field, e.g. `"Aadhaar
Number must be exactly 12 digits"`).

**Encryption ordering — the one thing this group must not get backwards
(§4.4's corruption trap, restated for the API context):** `encrypt_field`
runs on `aadhaar_number`/`apaar_id` **after** `validate_student` passes,
immediately before the `INSERT`/`UPDATE`. `validate_student`'s 12-digit
Aadhaar check must run against plaintext — running it after encryption
would reject every real submission. On the exception path
(`sqlite3.IntegrityError`, e.g. duplicate `roll_no`), the values in
`data` are already ciphertext (encryption happened before the DB call
that raised); if the route re-renders/returns that `data` for a form
retry, it must decrypt those two fields back to plaintext first, or the
next submission re-encrypts already-encrypted ciphertext and permanently
destroys the value. On a `ValueError` from `validate_student` itself,
`data` is still plaintext (validation runs before encryption) — do not
decrypt in that branch, `decrypt_field` will raise `InvalidToken` on real
plaintext.

**`students_list` masking:** every row decrypts `aadhaar_number` first,
then applies `mask_aadhaar()` to produce `aadhaar_masked` — never
decrypt-and-mask in the wrong order (masking raw ciphertext doesn't error,
it silently produces a garbage-looking-normal `"XXXX XXXX XXXX"` forever;
this exact failure mode was live-confirmed against the reference before
the fix existed there).

**Checklist seed on create:** creating a student also inserts 6 rows into
`checklist` (`roll_no`, item, status): `("Personal details", "Complete")`,
`("Documents", "Pending")`, `("ID card", "Pending")`, `("Fees",
"Pending")`, `("Attendance records", "Available")`, `("Marks records",
"Available")`. Port this insert verbatim on create — there is no
`checklist` read endpoint yet in this spec (not built in the reference
beyond the seed insert itself), but the rows must exist for future work
that reads them.

### 7.5 Faculty, Subjects, Academic Calendar — **[SPEC ONLY]**

Smaller CRUD groups, same shape pattern as Students. Sources:
`webapp/routes/faculty.py`, `webapp/routes/subjects.py`,
`webapp/routes/academic_calendar.py`.

**Faculty — `/api/faculty/*`, HOD-only for every route:**

| Route | Body | Response |
|---|---|---|
| `GET /api/faculty` | — | `{hours: [...], by_subject: {...}, accounts: [...]}` from `faculty_teaching_hours()` / `subject_faculty_map()` / `SELECT * FROM users WHERE role != 'STUDENT' ORDER BY role, username` |
| `POST /api/faculty/create-account` | `{username, full_name?, password, role, student_roll_no?}` | Calls `create_user(...)` unchanged. `ValueError`/`IntegrityError` → `400 VALIDATION_ERROR` |
| `POST /api/faculty/accounts/{id}/toggle-status` | — | Refuses if `account.username == caller.username` — a HOD **cannot deactivate their own logged-in account**; return `400` with that exact reasoning, don't silently no-op |
| `POST /api/faculty/accounts/{id}/reset-password` | — | Only valid for a `STUDENT` account row with a `student_roll_no`; calls `reset_student_password(...)`. `{username, password}` in response (temporary credentials, same shape as the create-student flow) |

**Subjects — `/api/subjects/*` + `/api/semesters/*`, HOD-only for every
mutating route (GET may be broader — confirm against §7.4's staff-vs-HOD
split when building; the reference gates the whole `/subjects` page to
HOD, so default to HOD-only on GET too unless a later requirement says
otherwise):**

| Route | Body | Response |
|---|---|---|
| `GET /api/subjects` | — | `{semesters, all_semesters, grouped, faculty}` — `grouped` is `all_subjects_admin()`'s per-semester subject grouping |
| `POST /api/subjects` | `{semester_id, code, name, has_lab}` | Calls `create_subject(...)`. Duplicate `(semester_id, code)` → `IntegrityError` → `400`, message `"A subject with that code already exists in this semester"` |
| `PATCH /api/subjects/{id}` | `{code, name, has_lab}` | Same duplicate-code handling |
| `POST /api/subjects/{id}/toggle-active` | — | Flips `subjects.active` |
| `POST /api/semesters/{id}/toggle-active` | — | Flips `academic_semesters.active` — deactivating hides the semester from every picker (subject list, attendance setup, academic calendar) without deleting any subjects/sessions/history tied to it; reversible |
| `POST /api/subjects/{id}/assign-faculty` | `{faculty_usernames: string[]}` | Calls `set_subject_faculty(...)` — replaces the full faculty assignment set for that subject, not an incremental add |

**Academic Calendar — `/api/academic-calendar/*`:**

| Route | Role | Response |
|---|---|---|
| `GET /api/academic-calendar` | any | Role-scoped: HOD sees every active semester (`academic_calendar_for_semesters(None)`); FACULTY sees only semesters they teach in (`faculty_semester_ids(username)`); STUDENT sees only their own `current_semester_id`. Response includes `can_edit: (role == "HOD")` |
| `POST /api/academic-calendar/{semester_id}/upload/{kind}` | HOD only | `kind` must be `"timetable"` or `"calendar"` — any other value is a no-op/400, not a 404 (the reference silently redirects on an invalid `kind`; the API version should `400 VALIDATION_ERROR` instead, since a silent no-op is worse behavior in a JSON API that has no page to redirect back to). Multipart, field `file`. Calls `save_calendar_file(...)` then `save_calendar_upload(...)`. `PhotoUploadError` → `400` with the error's message |

### 7.6 Self-service — `/api/me/*` — **[SPEC ONLY]**

Two source files cover three roles' worth of self-service, kept as two
files (not one) in the reference and should stay that way here — HOD and
FACULTY share fields, STUDENT is structurally different (keyed off
`students.roll_no` via `users.student_roll_no`, not `users` directly).

**HOD/FACULTY account — source `webapp/routes/self_profile.py`:**

| Route | Role | Body | Response |
|---|---|---|---|
| `GET /api/me/account` | HOD, FACULTY | — | `{user: <full users row>, specs: PROFILE_FIELD_SPECS}` |
| `PATCH /api/me/account` | HOD, FACULTY | every `PROFILE_FIELD_SPECS` key | Calls `validate_staff_profile(data)` then updates. `ValueError` → `400` |
| `POST /api/me/account/photo` | HOD, FACULTY | multipart, field `photo` | `{photo_path}` — `save_profile_photo(subdir="users", stem=username)` |
| `POST /api/me/account/change-password` | HOD, FACULTY | `{old_password, new_password, confirm_password}` | Same `change_password()` call as `/api/auth/change-password`; kept as a separate route because it's reached from a different screen (My Account, not the forced-reset gate) — do not collapse these into one route, the reference keeps them distinct for the same reason |

`PROFILE_FIELD_SPECS`: Full Name (`full_name`), Department (`department`),
Designation (`designation`), Employee ID (`employee_id`), Email
(`email`), Phone (`phone`), Qualification (`qualification`), Date of
Joining `YYYY-MM-DD` (`date_of_joining`). Shared by HOD and FACULTY —
nothing here is HOD-specific; split into two field sets only if a future
requirement asks for a genuinely role-specific field.

**Student self-service — source `webapp/routes/student_self.py`:**

| Route | Body | Response |
|---|---|---|
| `GET /api/me/profile` | — | `{student: <students row>}`. No matching `students` row for this `student_roll_no` → `404 STUDENT_NOT_FOUND` (matches the reference's `missing_student.html` branch) |
| `PATCH /api/me/profile` | every `SELF_FIELD_SPECS` key | `roll_no` and `department` are **not** student-editable — the route must inject the existing row's `roll_no`/`department` into the data dict before calling `validate_student`, exactly like the reference, not accept them from the request body. `roll_no` is the login-linked FK key (`users.student_roll_no`); letting a student edit it or their `department` could break their own login binding |
| `POST /api/me/profile/photo` | multipart, field `photo` | `{photo_path}` — `save_profile_photo(subdir="students", stem=roll_no)` |
| `GET /api/me/attendance/{subject_id}` | — | `{subject, sessions: [...], pct, band, present, total}` — same shape as `student_subject_history` in §7.2, this is the reference's separate `/me/attendance/{id}` route folded in; keep both reachable, they're not true duplicates (dashboard's version is discovered via the subject cards, this one is a direct link) |
| `POST /api/me/change-password` | `{old_password, new_password, confirm_password}` | Shared change-password entry point — reference's version branches destination by role (`/me/profile` for STUDENT, `/dashboard` otherwise) purely for the old redirect-based flow; in the JSON API this collapses to the same shape as `/api/auth/change-password` since there's no redirect to branch. Prefer routing STUDENT through this route and HOD/FACULTY through `/api/me/account/change-password` to keep the role split explicit, rather than building one universal change-password route that re-derives which screen called it |

`SELF_FIELD_SPECS` (student's own edit form — same field set as HOD's
editor minus Roll Number, which stays read-only): Full Name (`name`),
Father Name (`father_name`), Email (`email`), Phone (`phone`), Parent
Phone Number (`parent_phone`), Date of Birth `YYYY-MM-DD` (`dob`),
Category (`category`), Gender (`gender`), Seat Category
(`seat_category`), Address (`address`).

**Photo upload — shared implementation, `webapp/photo_upload.py`, port
unchanged as a backend utility module (not a route file):**
`save_profile_photo(file, *, subdir, stem)` validates via Pillow (opens +
`.verify()` + reopens + `.load()` — never trusts the client-supplied
filename/extension), 2MB cap, resizes to fit 400×400 via
`Image.thumbnail(..., Image.LANCZOS)`, pads onto a 400×400 canvas colored
`(245, 247, 251)` (matches the `--bg` CSS token) so every photo renders
as a consistent square regardless of source aspect ratio, always
re-encodes to JPEG quality 85 (normalizes format, strips anything in the
original file that isn't pixel data), saves as
`{safe_stem}-{uuid4().hex[:8]}.jpg` under `webapp/uploads/{subdir}/`.
Returns `/files/{subdir}/{filename}` — **never** a `/static/...` path;
uploads are never reachable through the public static mount (§7.7).
Raises `PhotoUploadError` (a `ValueError` subclass) with a
user-safe message on: no file selected, oversized, unreadable/non-image
content. Every route that accepts a photo calls this one function — do
not duplicate resize/validate logic per route.

### 7.7 Protected files — `/api/files/*` — **[SPEC ONLY]**

Source: `webapp/routes/protected_files.py`. **This route exists because
of a real historical data-exposure gap** — an earlier version publicly
mounted the entire `static/` directory including `static/uploads/` via
FastAPI's `StaticFiles`, with no auth check at all; student photos,
certificate scans, and calendar PDFs were reachable by anyone with (or
guessing) the URL. The fix moved uploads to a sibling directory
(`webapp/uploads/`, not `webapp/static/uploads/`) so the public static
mount can never physically reach them, and made this the *only* way to
read an uploaded file.

**Do not re-add an uploads path to any public static file mount in the
new backend.** If a new upload category is ever added, add a case to the
authorization function below — don't bypass this route.

`GET /api/files/{subdir}/{filename}` — requires `get_current_user`
(rate-limited via the same limiter as `/api/auth/login`, §5.2, fresh key
scheme — e.g. keyed by `username` or `client_ip:username` for this
route). Authorization (`_authorize(user, subdir, filename)`):

- `role in ("HOD", "FACULTY")` → always allowed, any subdir. **Role
  comparison must be uppercase** (`"HOD"`/`"FACULTY"`, matching the
  `CHECK` constraint and every other role comparison in this app) — a
  lowercase comparison here previously and silently broke staff access to
  every certificate file (HOD/FACULTY have `student_roll_no = NULL`, so a
  broken staff-bypass check falls through to the certificate rule below
  and wrongly 403s them).
- `subdir in ("students", "users", "academic_calendar")` → any logged-in
  user (any role) may view. These appear on shared pages (rosters,
  faculty lists, calendars) and carry low sensitivity.
- `subdir == "certificates"` → a STUDENT may view **only** a file whose
  filename stem starts with their own `roll_no.lower() + "-"`. No
  `student_roll_no` on the caller, or a filename that doesn't match →
  `403`.
- any other/unknown `subdir` → default-deny (`403`), not default-allow.

Path resolution: `target = (UPLOADS_ROOT / subdir / filename).resolve()`,
then confirm `UPLOADS_ROOT in target.parents or target == UPLOADS_ROOT`
before anything else — this blocks `../../` traversal via a crafted
`subdir`/`filename`. **`UPLOADS_ROOT` must itself be `.resolve()`d**, not
a plain relative path — comparing an unresolved root against an already-
resolved target silently makes the traversal guard a no-op (it 404s
every legitimate request instead of ever actually blocking a traversal
attempt). Derive `UPLOADS_ROOT` from the same constant the upload
functions write through (`photo_upload.UPLOADS_DIR`), not a separately
computed `Path(__file__).parent...` chain — a prior version of this exact
file counted one directory level wrong and 404'd every real upload for
every role, always; deriving both from one source is what prevents that
class of drift permanently. Nonexistent file, or a path that resolves
outside the uploads root → `404`.

---

## 8. Attendance — full detail

**[BUILT]** — `api/routes_attendance.py`, reusing
`sms_app/services/attendance_service.py`, `attendance_pdf.py`,
`sms_service.py` unchanged. Source: `webapp/routes/attendance.py`. This
is the highest-complexity group (session state machine, the 24h edit
window, the CRITICAL role-check history below) and the only screen with
real interaction, so it gets its own section rather than living in §7's
table.

### 8.1 The client-state-until-Save decision (§0.3, expanded)

The reference has five mutation routes because htmx does a partial-swap
per interaction and commits to the DB per click in some flows:
`mark/{roll}/{status}`, `toggle/{roll}`, `quick-mark`,
`mark-all-present`, `save`. **In the React rewrite, marking
present/absent is pure client-side state until one explicit Save action.**
`mark`, `toggle`, and `quick-mark` have **no backend equivalent at all**
— every tap is a local state update in the `AttendanceRegisterPage`
component, holding roughly `Map<roll_no, boolean>` seeded from `GET
/api/attendance/sessions/{id}`.

`mark-all-present` **stays a real endpoint** but does not write to the
DB — it returns the roster with every row flipped `present: true`, which
the frontend holds as client state exactly like any other tap. The
reasoning: `save_register()` is the single DB-write boundary for
attendance, already carrying its own 24h/role validation; a batch
convenience endpoint that wrote straight to the DB would be a second
write path needing its own copy of those checks kept in sync forever.
Instead `mark-all-present` reuses the same roster-loading logic as the
GET endpoint and just flips the `present` flag client-side-shaped in the
response — the actual commit only ever happens through `save`.

`save` is therefore the **only** endpoint in this group that writes to
`attendance_records`.

### 8.2 Routes

All under `/api/attendance`, staff-only (`HOD`, `FACULTY`) unless noted.

| Route | Notes |
|---|---|
| `GET /api/attendance/setup` | Semester list, subjects for a sensibly-defaulted semester (first semester that actually has subjects assigned to *this* caller — not just the first semester in sort order, which may be empty for them), and today's date in one call. `{semesters, subjects, default_semester_id, today}` |
| `GET /api/attendance/subjects?semester_id=` | Subject list refresh when the semester picker changes. `{subjects}` |
| `POST /api/attendance/sessions` | Get-or-create a session. Body: `{attendance_date, semester_id, subject_id, session_type, duration_hours, topic}`. Validates the subject exists and, if `session_type == "LAB"`, that the subject has `has_lab=1` (`400 VALIDATION_ERROR` otherwise). Then `validate_session_payload(...)` + `get_or_create_session(...)`. Response is built by re-fetching via `session_details(id)` — **not** by serializing the raw insert result — because `get_or_create_session` returns the bare `attendance_sessions` row (has `subject_id` but not the JOINed `subject_code`/`subject_name`/`semester_code`/`faculty_name` the response shape needs); this was caught by the group's own `TestClient` run as an `IndexError`, not assumed correct on the first pass. `201` on success. |
| `GET /api/attendance/sessions/{id}` | The register screen's one data call: `{session, editable, roster: [{roll_no, name, present}], present, absent}`. `editable` comes from `session_is_editable(session, role)` — the 24h window + role check (§8.3). Requires `_require_owner_or_hod` (§8.4). |
| `POST /api/attendance/sessions/{id}/mark-all-present` | No DB write (§8.1). Returns the same roster shape as GET, `force_present=editable` (only actually flips if the session is still in its editable window — an expired session's mark-all-present is a client-side no-op, matching what Save would reject anyway). |
| `POST /api/attendance/sessions/{id}/save` | **The single write boundary.** Body: `{present_roll_nos: string[]}` — the full set of currently-present roll numbers, not a delta. Calls `save_register(session_id, attendance, actor, role, session_type, duration_hours, topic)`. `PermissionError` (24h window expired) → `403 EDIT_WINDOW_EXPIRED`. `ValueError` → `400 VALIDATION_ERROR`. On success, queues SMS to absent students' parents (`queue_absentees_for_session`, only if there are any) and returns the fresh roster (`{session, roster, present, absent}`). |
| `GET /api/attendance/sessions/{id}/pdf?kind=present\|absent` | Returns the PDF binary directly (`application/pdf`, `Content-Disposition: inline; filename="attendance-{code}-{date}.pdf"`) — **not** wrapped in the `{data}` envelope, since it isn't JSON. **Not gated by the 24h edit lock** — viewing/printing an already-saved register is not editing it, same as the reference. Omit `kind` for the full roster. |

### 8.3 The 24-hour edit window and CRITICAL role-check

`session_is_editable(session, role)` (service layer, unchanged) — a
session is editable within 24 hours of `attendance_sessions.created_at`,
for the owning FACULTY or any HOD. This governs whether `GET
.../sessions/{id}` reports `editable: true` (controls whether the
frontend shows the Save button / tap targets as interactive at all —
§0's "no decorative controls" rule: a locked session shows no edit
control, not a disabled one) — but **the real enforcement is
`save_register()` itself raising `PermissionError` past the window**, not
just the frontend hiding the button. Never trust `editable` alone as the
authorization boundary; it's a UI hint, `save_register` is the actual
gate.

**CRITICAL role-check (from `RED_TEAM_FINDINGS.md`, carried forward as a
standing pattern, not just history):** every mutating route in this group
calls a `_require_staff(user)` check — `role not in ("HOD", "FACULTY")` →
`403` — **unconditionally, before any other logic**, and this check is
duplicated inline in `save()` specifically (not just relied on via the
shared helper) because `save()` is the actual write boundary the original
regression happened on. The separate `_require_owner_or_hod(user,
session)` check (FACULTY may only act on their *own* session;
HOD bypasses this and may act on any) is a **different** check that
governs *which* sessions a given FACULTY may touch — it does **not**, by
itself, block a non-FACULTY, non-HOD caller (e.g. a STUDENT token) from
reaching the route at all. A future edit to this group must not remove
`_require_staff`'s check thinking the ownership check already covers it
— it doesn't, and that gap is exactly what the red-team finding caught
originally.

### 8.4 `_require_owner_or_hod`

```
if user.role == "FACULTY" and session["faculty_username"] != user.username:
    raise ApiError("You do not have access to this session", 403, "FORBIDDEN")
```

HOD bypasses this entirely — can open, save, and print any faculty
member's session. FACULTY may only act on sessions where
`faculty_username` matches their own username.

### 8.5 PDF generation

`attendance_pdf.build_attendance_pdf(session, roster)` — `reportlab`,
unchanged from the reference. Takes the same `session` dict shape
`_serialize_session` produces and a roster list (optionally pre-filtered
to present-only or absent-only by the route before calling it, per the
`kind` query param) — the filtering happens in the route, not inside the
PDF builder, so the builder itself doesn't need to know about the
present/absent/full distinction.

---

## 9. Frontend design system — CSS carryover

**Visual refresh scope: none (§0.5).** This is a transport rewrite. Port
`webapp/static/css/app.css` (866 lines) as plain CSS with the same custom
properties, same class names, same layout math — not a Tailwind
conversion, not a component-library reskin, not new tokens. The ported
file already exists as `frontend/src/tokens.css` and covers everything
Groups 1–3 (Auth, Dashboard, Attendance) need. **Port the remaining
sections the same way, verbatim, as each unbuilt group (§7.4–7.7) is
implemented** — do not reinterpret the palette or invent new classes
where an existing one already covers the case.

### 9.1 Tokens (already ported, `:root`)

```css
--nav: #092b49;      --nav2: #123f6c;      --blue: #1769e8;
--green: #18a957;    --yellow: #d97706;    --red: #dc3545;
--bg: #f5f7fb;        --text: #101828;      --muted: #667085;
--border: #e1e6ef;   --border-light: #dfe4ec;
--row-alt: #fbfcfe;  --row-tint: #f7f9fc;
```

One accent color per semantic state only: red = critical/absent, green =
normal/present, amber(`--yellow`) = warning. `body { font-family: "Segoe
UI", system-ui, -apple-system, sans-serif; font-size: 14px; }`. No
shadows, no gradients, no animation beyond the two named exceptions
below.

### 9.2 Sections already ported into `tokens.css` (Groups 1–3)

App shell (`.app-shell`, `.nav-rail`, `.main-area`, `.main-top`,
`.main-body`), cards (`.card`, `.card-pad`, `.stat-row`, `.stat-card`),
tables (`.table-wrap`, `table.data-table` incl. the register-specific
`.absent-btn` pill and `td.roll`), buttons (`.btn` + variants
`btn-sm`/`btn-outline`/`btn-muted`/`btn-warn`/`btn-green`/`btn-red`/
`btn-block`), form fields (`.field`), state chips (`.chip-*`,
`.pct-*`), login (`.login-shell`/`.login-side`/`.login-area`/
`.login-card`/`.login-error`/`.checkbox-row` — **see §12, this is the
wrong login styling for the actual login page**), the 15-day HOD
dashboard (`.day-group`, `.session-row`), student dashboard subject cards
(`.subject-cards`, `.subject-card`, `.subj-history*`), the roster overlay
(`.roster-overlay`, `.roster-panel*`), and the mobile breakpoint
(`@media (max-width: 860px)`, replaces `.nav-rail` with `.bottom-nav`).

### 9.3 Sections NOT yet ported — needed for §7.4–7.7's unbuilt groups

Pulled from `app.css` by diffing its selectors against `tokens.css`;
port each verbatim from `app.css` when its owning group is built:

- **`.animlogin-*`** (lines ~349–505 of `app.css`) — the real,
  currently-shipped login page: dark diagonal-split two-panel layout
  (`.animlogin-container`, `.animlogin-curved`, `.animlogin-info`,
  `.animlogin-formbox`), staggered `--d`-indexed entrance animation
  (`@keyframes animlogin-in`), custom-styled inputs/checkbox/submit
  button (`.animlogin-box`, `.animlogin-checkbox`, `.animlogin-btn` with
  its `::before` hover-fill sweep). **This — not `.login-*` — is "the
  login screen's existing diagonal-split animation" §0.5 names as the one
  animation exception to the no-new-motion rule.** `.login-*` (already
  ported) is the reference's *separate*, plainer white/blue-themed style
  used only for `force-password-change` — the reference's own CSS
  comment states this split explicitly (`"Auth pages using the app's
  normal white/blue/navy theme... separate from the orange animated
  .animlogin-* login page below, which is a different, intentionally
  distinct screen"`). See §12 for the current frontend's mismatch on
  this exact point.
- **`.form-grid`, `.segmented`** — multi-column form layout and a
  segmented-button control (e.g. Active/Inactive toggles), needed for
  the Students create/edit form (§7.4) and Subjects page (§7.5).
- **`.detail-box`, `.subtitle-muted`** — needed for the Student detail
  view (§7.4) and similar single-record detail screens.
- **`.magic-nav`** — a `nth-child`-indexed animated mobile nav variant
  present in `app.css` but not referenced by any currently-live template;
  confirm against the actual in-use templates for each newly-built group
  before porting this — it may be dead/experimental CSS rather than a
  section any shipped page actually needs. Don't port speculatively.
- **`.register-row`, `.register-header`, `.register-summary`,
  `.mark-btn`/`.mark-btns`, `.locked-banner`, `.session-meta`,
  `.attendance-layout`, `.quick-panel`** — these style the *reference's*
  htmx-driven attendance register layout (a two-column sheet+quick-panel
  design with inline present/absent pill buttons per row). **The React
  rewrite's `AttendanceRegisterPage` already uses a different, simpler
  layout** — a `table.data-table` with the register-specific `.absent-btn`
  rule already ported into `tokens.css`, not the `.mark-btn`/`.register-row`
  family. This is a **deliberate, working deviation**, not a gap — do
  not port these classes or try to reconcile the two layouts; the
  already-built, already-live-tested register page is the standard to
  keep, not `app.css`'s corresponding section. Documented here only so a
  fresh agent doesn't "fix" the register page into matching a CSS section
  it was never meant to use.

---

## 10. Frontend structure

### 10.1 Stack and directory shape

Vite + React 18, React Router 6, TypeScript. No Redux/heavy state
library — React Query or equivalent for server state is allowed but not
yet introduced in the built groups (they use plain `useState` +
`useEffect` fetches); don't add a data-fetching library speculatively for
groups that don't need it yet.

```
frontend/
  src/
    api/            — one file per route group: auth.ts, dashboard.ts,
                      attendance.ts, students.ts (built as a stub ahead
                      of its backend, §7.4), client.ts (the shared fetch
                      wrapper, §10.3)
    components/     — shared UI; currently just AppShell.tsx
    pages/
      auth/          — LoginPage, ForcePasswordChangePage
      dashboard/     — DashboardPage (role-branches to HodDashboard /
                       StudentDashboard internally), HodDashboard,
                       StudentDashboard
      attendance/    — AttendanceSetupPage, AttendanceRegisterPage
      students/      — StudentsListPage, StudentFormPage, StudentViewPage
                       (frontend built ahead of backend — §7.4)
    hooks/           — useCurrentUser.ts
    nav.ts           — per-role nav item list, port of webapp/nav.py
    tokens.css       — port of app.css, §9
    App.tsx          — route table + auth/role guards
    main.tsx
  index.html
  vite.config.ts
```

### 10.2 Routing and guards (`App.tsx`)

One `<Routes>` tree, no nested layout routes yet — every route's
`element` inline-branches on `user`/`must_change_password`/`role` via
`Navigate`. Pattern for every protected route:

```
!user                        → <Navigate to="/login" />
user.must_change_password    → <Navigate to="/force-password-change" />
<role not permitted here>    → <Navigate to="<fallback>" />
otherwise                    → render the page
```

Route table so far (`/*` catch-all is `DashboardPage`, which itself
role-branches):

```
/login
/force-password-change
/attendance
/attendance/sessions/:sessionId
/students                    (HOD, FACULTY only — STUDENT → "/")
/students/new                (HOD only — non-HOD → "/students")
/students/:studentId/edit    (HOD only)
/students/:studentId         (HOD, FACULTY — STUDENT → "/")
/*                           → DashboardPage
```

As each unbuilt group (§7.5–7.7) lands, add its route here following the
same guard pattern — a page for a role that can't use it is a
`<Navigate>`, never a rendered-but-broken page.

### 10.3 API client (`api/client.ts`)

One `apiFetch<T>(path, options)` wrapper every `api/*.ts` file calls
through — never raw `fetch()` from a route-group file. Responsibilities,
all in one place instead of duplicated per call site:

- Attaches `Authorization: Bearer <token>` from the in-memory
  `accessToken` variable (never persisted to storage — §5).
- Always sends `credentials: "include"` (required for the refresh cookie
  to travel).
- Unwraps the `{data}`/`{error}` envelope; throws `ApiClientError(message,
  status, code)` on any `error` shape or non-2xx.
- **Silent refresh-and-retry on 401 `TOKEN_INVALID` specifically** (not
  on `NOT_AUTHENTICATED` — a request that never had a token has nothing
  to refresh into): calls `POST /api/auth/refresh` once, and if it
  succeeds, retries the original request once. `attemptRefresh()` is
  de-duped via a shared in-flight promise so several concurrent 401s
  don't each fire their own refresh call.
- `skipRefreshRetry` option to opt out — used by `login()` (a failed
  login is never a stale-token situation) and by `refresh()` itself (no
  recursive retry of the refresh call).

`apiUpload<T>(path, file, fieldName)` — same auth/refresh/envelope
handling, but omits `Content-Type` so the browser sets its own multipart
boundary (a manually-set `multipart/form-data` header with no boundary
breaks every backend's parsing). Used for every file upload — student
photo, staff photo, academic calendar documents. Never build a
`FormData` request outside this helper.

### 10.4 `useCurrentUser` and app-mount flow

Because the access token only lives in memory, a hard page refresh always
starts with none. `useCurrentUser()` runs on mount: attempts `POST
/api/auth/refresh` first (the httpOnly cookie survives a refresh even
though the JS variable doesn't) — if that fails, falls through to `GET
/api/auth/me` failing too, which correctly resolves to "not logged in."
If refresh succeeds, `/api/auth/me` then confirms the session and
populates `user`. Exposes `{user, loading, reload}` — `reload` re-runs
this whole flow after a successful login or password change so route
guards see fresh state without a full page reload.

### 10.5 `AppShell` and `nav.ts`

`AppShell` (`components/AppShell.tsx`) is the single shared wrapper for
every authenticated page — nav rail (desktop) + bottom nav (mobile),
driven by one `navItemsFor(role)` call (`nav.ts`, ported from
`webapp/nav.py`) so both renderings always agree, and so adding a real
nav item is a one-file edit instead of three (before this component
existed, `HodDashboard`/`StudentDashboard`/`AttendanceSetupPage` each
hand-rolled their own copy of the nav with separately hardcoded
active/disabled state).

**Per §0's "no decorative controls" rule, with one documented,
time-boxed exception:** a nav item pointing at a route not yet built in
this rewrite renders `disabled: true` (grayed out, `title="Coming soon"`,
no navigation) rather than being omitted — this is explicitly **not**
the final intended state (§0 core principle 2's stated exception), and
`disabled: true` must be removed from an item the moment its route lands
in `App.tsx`. Do not ship the rewrite with any nav item still marked
`disabled` — every one currently marked that way exists only because its
backing group is in §7's **[SPEC ONLY]** state; clearing them is a
byproduct of completing §7.4–7.7, not a separate task.

---

## 11. Deployment topology

Two fully separate processes, from day one (§0.4, final — not a
transition state that later collapses into one process):

- **API:** `run_api.py` → `uvicorn.run("api.app:app", host="0.0.0.0",
  port=8001)`. Refuses to start (`sys.exit(1)`) if `SMS_SECRET_KEY` is
  unset — identical hard-stop to the old `run_web.py`, since both sign
  tokens/cookies from the same `SECRET_KEY` (§5).
- **Frontend:** dev — Vite dev server (`localhost:5173`) pointed at the
  API's `/api` routes via `API_BASE` in `client.ts`. Prod — a static
  build (`vite build`) served by any static file host / same machine via
  nginx or `serve`; this is a plain static bundle with no server-side
  rendering step, so any conventional static host works.
- The old Jinja/HTMX app (`run_web.py`, port 8000) is **retired
  entirely** once cutover happens — SMS-17.2 is the *behavioral*
  reference this document specifies against, not a system that keeps
  running alongside the new one in production. (During active
  development of a not-yet-proven group, it's fine for both to run
  side-by-side locally for comparison — that's a dev-time convenience,
  not the shipped topology.)
- `SMS_ENV=production` must be set in any real deployment (→ refresh
  cookie `secure=True`, §5) **and** the deployment must actually serve
  over HTTPS — setting the flag without HTTPS makes the browser reject
  the cookie for the opposite reason it was unset in dev.
- CORS `allow_origins` in `api/app.py` must be updated from the dev-only
  localhost list to the real frontend origin(s) before any production
  cutover — never widen it to `"*"` (incompatible with
  `allow_credentials=True`, which the refresh-cookie flow requires).

---

## 12. Discrepancy log — drift already found and required fixes

This section exists because the `Sms-ReWrite` drop is not simply
"finished work to reuse" — it is confirmed correct for Groups 2–3 and
partially incorrect for Group 1. Fix these before treating Group 1 as
done; do not silently inherit them into new work.

### 12.1 Login `role` field — must be removed (CRITICAL, §0.2)

Confirmed present in **four** files, all needing the same fix:

1. **`database.py`** — `auth()` must take exactly `(username, password)`.
   If the copy in hand has a third `role` parameter and filters the
   `SELECT` by it, remove the parameter and the filter; role is read off
   the found row, never supplied as a lookup key.
2. **`api/routes_auth.py`** — `LoginBody` must be `{username: str,
   password: str}` — no `role` field. The call `auth(body.username,
   body.password, body.role)` must become `auth(body.username,
   body.password)`. Error message on failure must be `"Invalid
   credentials or inactive account"` (drop "or role").
3. **`frontend/src/api/auth.ts`** — `login(role, username, password)`
   must become `login(username, password)`; the request body must drop
   `role` entirely.
4. **`frontend/src/pages/auth/LoginPage.tsx`** — remove the `role`
   `<select>` field (`useState<Role>("HOD")`, the `<option>` list, and
   the `<div className="field login-animate">` block rendering it) and
   the `role` argument in its `login(role, username, password)` call.

This is not a stylistic preference — §0.2 states the current SMS-17.2
login has no role picker, `auth()` takes no role argument, and this "must
match this exactly." The drift reintroduces a feature that was
deliberately removed from the reference at some point before this
rewrite began.

### 12.2 Login page CSS — wrong style family in use

`LoginPage.tsx` renders with `.login-shell`/`.login-side`/`.login-card`
(the plain white/blue theme reserved, per the reference's own CSS
comment, for `force-password-change` and similar auth-adjacent screens)
instead of `.animlogin-*` (the dark diagonal-split, staggered-entrance
style that is the reference's actual, currently-shipped login page — see
§9.3). Fix: rebuild `LoginPage.tsx`'s markup against the `.animlogin-*`
class names and structure (`.animlogin-container` → `.animlogin-curved` +
`.animlogin-info` + `.animlogin-formbox`), and port the corresponding CSS
block from `app.css` (lines ~349–505) into `tokens.css` alongside this
fix — it was correctly left unported until now specifically because
Group 1's frontend hadn't been corrected yet.

The staggered-entrance animation technique the current `LoginPage.tsx`
already implements (`--i`-indexed `login-animate` class, `stagger()`
helper) is a reasonable adaptation and does not itself need to be thrown
away — re-point the same technique at `.animlogin-el`'s `--d`-indexed
variant instead of building a third approach from scratch.

### 12.3 Route-name differences — confirmed intentional, not drift

`_DEST_BY_ROLE` in `api/routes_auth.py` (`/account`, `/account`,
`/profile`) doesn't match the old Jinja paths (`/me/account`,
`/me/account`, `/me/profile`). **This is not a defect** — `/me/*` was a
Jinja-side URL-namespacing convention with no forced equivalent in a
client-routed SPA, and the new frontend's shorter paths are a legitimate,
independent naming choice for the new router (§5.3). Listed here only so
a future audit doesn't mistake it for the same class of problem as §12.1.

### 12.4 Anything not listed here

If a future session finds the live `Sms-ReWrite` code disagreeing with
this document anywhere else in Groups 1–3 (built), treat **this
document** as authoritative and the code as needing a fix, unless the
disagreement is a case like §12.3 — a deliberate, reasoned adaptation
that doesn't change behavior in a way SMS-17.2's users would notice.
When in doubt, re-derive the answer from the SMS-17.2 source file named
in the relevant section above, not from what the partial rewrite already
did.
