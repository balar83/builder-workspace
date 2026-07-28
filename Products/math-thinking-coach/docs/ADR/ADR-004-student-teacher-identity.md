# ADR-004: Student/Teacher Identity (Milestone A)

**Status:** Accepted
**Date:** 2026-07-28

---

## Problem

The next milestone — a scalable assessment system (Assessment Engine, server-side attempt history, adaptive selection, teacher-ready assessment generation) — cannot be built without a concept of "which student" and "which teacher" the backend is talking to. Today there is no auth anywhere in this system: every `/api/v1` route is open, and Release 0.1's progress tracking is anonymous, per-browser, `localStorage`-only. This ADR covers only the identity layer itself — a deliberately separated, smaller prerequisite milestone (Milestone A), not the assessment engine, attempt history, or adaptive selection it unblocks.

A second, non-technical problem shaped this ADR as much as the technical one: Class 8 students are minors, and `Product-Vision.md`'s target audience is specifically them. Collecting real emails/passwords for students adds real privacy-compliance surface this project has no reason to take on for an identity layer this small.

---

## Options Considered

**Student identity**
1. Full accounts (email + password) for both students and teachers.
2. Teacher gets a real account (email + password); students join via a teacher-issued class code + display name + short PIN, no email collected.

**Where accounts are persisted**
1. A real database (the same technology Milestone B will need for attempt history), decided now.
2. A minimal JSON file store (`teachers.json`, `classes.json`, `students.json`), mirroring the exact pattern `chapters.json`/`topics.json` already use.

**Session mechanism**
1. JWT bearer token, stored and attached by the frontend.
2. HTTP-only, signed session cookie (Starlette's `SessionMiddleware`, `itsdangerous`-backed).

**Blast radius on existing routes**
1. Gate all existing content routes (`/chapters`, `/questions`, `/topics`) behind auth.
2. Leave existing content routes open; auth only gates new routes this and later milestones add.

**Scope boundary**
1. Make login mandatory to use the app in this milestone.
2. Ship login/join as a dormant, additive capability — the existing anonymous flow keeps working unchanged; nothing consumes identity yet.

---

## Decision

**Student identity — Option 2.** `POST /auth/teacher/register` creates a teacher account (email, bcrypt-hashed password, name). `POST /auth/teacher/classes` (teacher-session-gated) creates a `ClassGroup` with a randomly generated 6-character join code (`auth_service._generate_class_code`, excludes visually ambiguous characters `0`, `O`, `1`, `I`). `POST /auth/student/join` creates a `Student` from a class code + display name + a bcrypt-hashed 4+-digit PIN — no email, no password. Display names are unique per class (case-insensitive), not globally, so "Asha" can exist in two different classes without collision.

**Persistence — Option 2.** `backend/app/data/{teachers,classes,students}.json`, read/written by `auth_service.py` under a single `threading.Lock`, atomic write via write-to-`.tmp`-then-rename (the same pattern ADR-003's `mergeAndWrite.js` established for the content pipeline). All three files are gitignored — even bcrypt-hashed credentials have no reason to be committed. This deliberately defers the real database decision to Milestone B, where attempt-history volume will actually force it, rather than deciding it as a side effect of an identity layer this small.

**Session — Option 2.** Starlette's `SessionMiddleware`, added in `main.py`, keyed by `settings.session_secret_key` (env `SESSION_SECRET_KEY`, insecure dev default — must be set for any real deployment). `same_site="lax"`, `https_only=False` (matches this project's current dev-only posture — no HTTPS anywhere yet). CORS already had `allow_credentials=True` set, so no CORS change was needed. The session stores only `{"role": "teacher"|"student", "id": "..."}` — never a name, email, or PIN.

**Blast radius — Option 2.** `/chapters`, `/questions`, `/topics`, and the answer-evaluation endpoint are completely untouched — confirmed by `test_existing_content_routes_remain_unauthenticated` and the full pre-existing test suites passing unmodified. Only the new `/auth/*` routes exist behind session checks (`_require_teacher` for class creation).

**Scope boundary — Option 2 (dormant).** This milestone adds working login/register/join/logout/`me` endpoints and matching frontend pages (`TeacherAuthPage`, `StudentJoinPage`, reachable from `HomePage`), but does not touch `progressService`/`progressStore`, does not migrate any `localStorage` data, and does not gate any existing page or route. Logging in has no user-visible effect yet beyond having a session — verified live: the pre-existing anonymous chapter → question flow works identically with or without a logged-in session cookie present.

---

## Trade-offs

**Pros**
- No minor's email or password is ever collected — only a teacher-issued code, a display name, and a short PIN, all under the teacher's own class.
- Fully additive: every existing test (79 backend, 49 frontend) passes unmodified; the anonymous flow this product has always had is untouched and independently verified live.
- Reuses this project's own established patterns rather than inventing new ones: JSON-file persistence (question/topic services), atomic tmp-then-rename writes (ADR-003), a single lock around file mutation (`shadow_log_writer.py`), defensive read (`_read_store` never throws on missing/corrupt data, mirroring `progressStore.ts`'s philosophy).
- Fully reversible: nothing in the existing app depends on this milestone existing. It can be deleted without touching anything else.

**Cons**
- A 4+-digit PIN, even bcrypt-hashed, is a weak secret by adult-security standards — acceptable here because the threat model is a classmate guessing another student's login, not a targeted attacker, and there is nothing sensitive behind a student session yet (no attempt history, no assessment data — that's Milestone B/E).
- `session_secret_key` defaults to an insecure dev value and `https_only=False` — both fine for local development, both **must** be revisited before any real deployment. Not addressed here because no deployment story exists yet for this project.
- JSON-file persistence for accounts has the same ceiling ADR-003 already named for content: fine at classroom scale, not designed for real multi-school volume. Named explicitly as the reason Milestone B's persistence decision is not resolved by this ADR.
- No password-reset flow, no rate-limiting on login attempts, no "list my classes" endpoint for a teacher managing more than one class at a time (a teacher only sees a class's code at the moment they create it). All acceptable gaps for a first slice, not silently assumed away.

---

## Future Evolution

Milestone B (server-side attempt history) is the natural point to revisit the JSON-file-vs-database decision, once real volume and query needs exist — this ADR deliberately doesn't pre-decide that. If a teacher needs to manage multiple classes day-to-day, a "list my classes" endpoint should be added then, driven by that real need. Session security hardening (`session_secret_key` rotation/secrets management, `https_only=True`) belongs to whatever ADR eventually covers a real deployment target — not invented speculatively here.

---

## Impact

**Backend** — New: `app/schemas/user.py`, `app/services/auth_service.py`, `app/api/routes/auth.py`, `backend/tests/test_auth.py`. Modified: `app/main.py` (`SessionMiddleware`), `app/core/config.py` (`session_secret_key`), `app/api/router.py` (mounts the auth router), `backend/requirements.txt` (+`itsdangerous`, +`bcrypt`), `backend/.gitignore` (+3 account files).

**Frontend** — New: `src/types/auth.ts`, `src/services/authService.ts`, `src/pages/{TeacherAuthPage,StudentJoinPage}.{tsx,css}`, `frontend/tests/services/authService.test.ts`. Modified: `src/App.tsx` (2 new routes), `src/pages/HomePage.tsx` (2 discoverable links), `src/App.css` (`.link-button`, `.home-auth-links`).

**API** — Additive only: `POST /auth/teacher/register`, `POST /auth/teacher/login`, `POST /auth/teacher/classes`, `POST /auth/student/join`, `POST /auth/student/login`, `POST /auth/logout`, `GET /auth/me`. No existing route's contract changed.

**Tests** — Backend 79/79 passing (65 → 79; +14 for `test_auth.py`). Frontend 49/49 passing (40 → 49; +9 for `authService.test.ts`). Live-verified: teacher register → create class → code; student join → login round trip; wrong-PIN rejection; pre-existing anonymous chapter/question flow confirmed unaffected.

---

## Related Documents

- [`ADR-003-content-authoring-and-export-pipeline.md`](ADR-003-content-authoring-and-export-pipeline.md) — the atomic-write and lock-guarded-file patterns this ADR reuses.
- `Products/math-thinking-coach/docs/Roadmap.md` — Milestone A's place in the "scalable assessment system" sequencing (Milestones A–F).
- `Products/math-thinking-coach/docs/Development-Journal.md` (2026-07-28 entry) — the implementation record.
