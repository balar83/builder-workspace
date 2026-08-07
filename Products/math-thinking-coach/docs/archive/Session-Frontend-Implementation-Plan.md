# Student Learning Experience — Implementation Plan

**Milestone:** F0 — Student Learning Experience Implementation Planning
**Status:** Planning artifact only. No code, no backend changes, no API changes, no architectural changes.
**Feeds:** Milestone F1 (implementation)
**Date:** 2026-07-29

Grounded in a direct read of every file under `frontend/src/` and `frontend/tests/` as they exist at commit `fd2cf60`, plus [ADR-006](ADR/ADR-006-learning-session-planning-architecture.md), [ADR-007](ADR/ADR-007-learning-session-runtime-architecture.md), and `Release-Plan-v1.0.md`. Nothing below assumes code that doesn't already exist.

---

## 1. Existing frontend inventory — what's reusable

### 1.1 Reusable components (used as-is, no modification)

| Component | Contract | Why it drops in unchanged |
|---|---|---|
| `AnswerInput` (`components/AnswerInput.tsx`) | `{value, onChange, onSubmit, disabled?}` | Session's `QuestionContent` needs the same free-text answer + submit interaction as the standalone flow. No session-specific shape. |
| `HintPanel` (`components/HintPanel.tsx`) | `{hints: string[], currentHintIndex: number}` | Session's `CurrentQuestionResponse.question.hints` is delivered as a full array upfront, identical to today's `Question.hints` — hint reveal is client-side-only either way (confirmed: `hintsUsedTotal` stays 0 server-side per ADR-007). |
| `SolutionPanel` (`components/SolutionPanel.tsx`) | `{solution: string}` | Same reasoning — `QuestionContent.solution` is delivered upfront, identical shape to `Question.solution`. |
| `DifficultyBadge` (`components/DifficultyBadge.tsx`) | `{level: Difficulty}` | `QuestionContent.difficulty` uses the identical `'Easy'\|'Medium'\|'Hard'` union already defined in `types/question.ts`. |
| `QuestionProgress` (`components/QuestionProgress.tsx`) | `{totalQuestions, currentQuestion}` (1-indexed) | Reusable, with one required transform at every call site: session `position` is 0-indexed (ADR-007 is explicit that display indexing is a frontend concern), so callers must pass `currentQuestion={position + 1}`. Flagged as Risk #5 in §8. |
| `ProgressBar` (`components/ProgressBar.tsx`) | `{percent: number}` | Reusable unchanged for the hint-reveal meter, exactly as today. |

### 1.2 Reusable services (used as-is, no modification)

| Service | What's reused |
|---|---|
| `questionService.ts` | `getChapters()`, `getChapter()`, `getTopics()`, `getTopic()` — Dashboard and Start Practice both need chapter metadata; no session-specific chapter lookup is needed since chapters aren't a session concept. `submitAnswer()`/`getQuestion()` stay standalone-flow-only, not reused by session pages. |
| `authService.ts` | `loginStudent()`, `joinClass()`, `getCurrentUser()`, `logout()` — all reused as-is. **`getCurrentUser()` exists today but is currently called by no page anywhere in the app** — it's the missing piece the new route guard needs (§6, §8 Risk #1). |
| `progressService.ts` / `progressStore.ts` | Not reused directly (session progress is server-owned, §5) — but their **pattern** (a service function layer in front of one private `localStorage` accessor, `mtc.progress.v1`) is the exact pattern the new session resume pointer must mirror, per `Release-Plan-v1.0.md` §13. The anonymous flow's own use of these two files is untouched. |

### 1.3 Reusable layouts / structural conventions

- Every existing page wraps its content in `<main className="container">` (`App.css`) — centered flex column, 24px padding. All new pages should do the same for consistency, even where a page (like the Question screen) needs to break out of the narrow 320px `.button-group` width — the established pattern for that is a page-specific CSS file layered on top of `.container`, exactly as `QuestionPage.css` already does (`.question-card { max-width: 920px; }` inside a `.container` parent).
- One CSS file per page component (`ChapterSelectionPage.css`, `QuestionPage.css`, `TopicPage.css`, `TeacherAuthPage.css`, `StudentJoinPage.css`) — new pages should follow the same one-file-per-page convention, not a shared session stylesheet.
- Form pages (`StudentJoinPage.tsx`, `TeacherAuthPage.tsx`) share an identical shape worth reusing structurally (not as a component, as a pattern): local `useState` per field, a single `handleSubmit`, an inline error paragraph (`className="*-error"`), a `.button-group` for actions. Start Practice's configuration form should follow this exact shape.

### 1.4 Reusable styling patterns

- **Global primitives** (`App.css`): `.container`, `.button-group`, bare `button`, `.tagline`, `.link-button` — used by every page today, all reusable as-is.
- **Coaching visual language** (`QuestionPage.css`): `.hint-button` / `.hint-button-suggested` (with its pulse `@keyframes`) is the exact, already-shipped visual treatment for "the coach is nudging you toward this action" — must carry over unchanged into the session Question screen, since `ui.hintLevel`/`coach.nextAction` semantics are byte-identical between the standalone and session answer contracts (ADR-001 unchanged).
- **Color convention**: `DifficultyBadge` inlines hex colors directly in the component (`#10b981`/`#f59e0b`/`#ef4444`) rather than using CSS custom properties. This is the established convention to match — any new status/mode badges (Practice/Test/Revision, Completion status) should follow the same inline-hex-in-component approach, not introduce a CSS-variable-driven theme layer that doesn't exist elsewhere in this app.
- **Note, not a recommendation to fix**: `index.css`'s Vite-template variables (`--accent`, `#root { width: 1126px }`, `.counter`) are not referenced by any existing page's classNames — they appear to be inert leftovers. New pages should not assume they form a real design system (§8 Risk #4).

---

## 2. Component hierarchy for the Session Frontend

### 2.1 New pages

| Page | Route | Purpose |
|---|---|---|
| `DashboardPage` | `/dashboard` | Post-login home: chapter list + performance + resume banner |
| `StartPracticePage` | `/practice/:chapterId` | Mode/difficulty/count/time-limit configuration, creates the session |
| `SessionQuestionPage` | `/session/:sessionId` | The full question → answer → coaching feedback loop, one question at a time |
| `SessionCompletePage` | `/session/:sessionId/complete` | Terminal summary (completed/expired/abandoned), mode-aware |

No dedicated route for the sub-second "Session Creation" transitional screen from the earlier UX review — it's a loading state *inside* `StartPracticePage` (spinner after submit, until navigation) and the *initial* loading state of `SessionQuestionPage` (fetching the first `current-question`), not a screen a student could ever bookmark or land on independently.

### 2.2 New shared components

| Component | Used by | Notes |
|---|---|---|
| `RequireStudent` | Wraps all four new routes in `App.tsx` | The one genuinely new architectural piece. Calls `authService.getCurrentUser()` on mount; redirects to `/student/join` if not a logged-in student. Justified as shared (not speculative) because **all four** new routes need the identical check — this is present, concrete reuse-through-need (`AI-Builder-OS/ENGINEERING_PRINCIPLES.md`), not a guard built ahead of a need that might arrive later. |
| `ChapterPerformanceCard` | `DashboardPage` | New sibling to `ChapterCard`, not a modification of it — reuses `ChapterCard.css`'s visual class family (`.chapter-card`, `.chapter-card-content`) for consistency, but has a different data source (`TopicPerformance[]` roll-up per chapter, not `progressService`'s `localStorage` count) and must not touch `ChapterCard.tsx` itself, whose existing tests pin an exact navigation target and badge text (§8 Risk #3). |
| `ResumeBanner` | `DashboardPage` | Small, presentational: "Continue where you left off in {chapter}" + a button. Built in Slice 7 (§3), not earlier — has no reason to exist before the resume pointer itself does. |
| `SessionModeSelector` | `StartPracticePage` | The mode (Practice/Test/Revision) + difficulty + count + time-limit form controls. Plain controlled inputs, same shape as `TeacherAuthPage`/`StudentJoinPage`'s existing form pattern — not a new abstraction, just this page's fields. |
| `SessionCompleteSummary` | `SessionCompletePage` | Mode-aware terminal message: qualitative-only for Practice/Revision, score shown only for Test — the one place in the whole app a score is rendered. |

**Deliberately not built as separate components**: the coaching-feedback block (evaluation/coach/ui-driven controls) on `SessionQuestionPage`. `QuestionPage.tsx` already implements this inline, not as its own component — the Session Frontend should match that existing convention rather than introduce a new abstraction the old page never needed.

### 2.3 Routing updates

See §6 for the full table; summary: four new routes added to `App.tsx`, all wrapped in `RequireStudent`, none of the seven existing routes modified except one navigation-target change inside `StudentJoinPage.tsx` (§6).

---

## 3. Implementation order — slices

The suggested structure is already close to the real dependency order; the one refinement is splitting "Session Configuration" (the form) from "Session Creation" (the API call + navigation) as two genuinely independent testable units, and folding the auth guard into Slice 1 since every later slice depends on it.

| # | Slice | Depends on |
|---|---|---|
| 1 | Dashboard integration (incl. `RequireStudent`) | Nothing new — existing `authService`/`questionService` only |
| 2 | Session configuration (form UI only) | Slice 1 (needs a route to navigate *from*) |
| 3 | Session creation (API wiring) | Slice 2 |
| 4 | Question experience (fetch + render + submit plumbing) | Slice 3 (needs a real `sessionId`) |
| 5 | Coaching feedback (full response-driven UX) | Slice 4 |
| 6 | Session completion | Slice 5 (needs a real terminal `sessionStatus` to reach) |
| 7 | Resume support | Slice 6 (resume must land somewhere real, including Completion) |
| 8 | Final polish | All of the above |

### Slice 1 — Dashboard integration

- **Scope**: `RequireStudent` guard component; `DashboardPage` shell — student name, chapter list via `questionService.getChapters()`, per-chapter performance via a new `GET /performance/me` call, no resume banner yet (Slice 7). `StudentJoinPage.tsx`'s success branch changes its "Back to Home" navigation target to `/dashboard`.
- **APIs used**: `GET /auth/me` (guard), `GET /chapters`, `GET /performance/me`.
- **New files**: `pages/DashboardPage.tsx` + `.css`, `components/RequireStudent.tsx`, `components/ChapterPerformanceCard.tsx` + `.css`, `types/performance.ts` (new — `TopicPerformance` has no existing frontend type), a small `performanceService.ts` (or an addition to `questionService.ts` — recommend a new file, since performance isn't chapter/question content and `questionService.ts`'s existing name doesn't fit it).
- **Modified files**: `App.tsx` (new route + guard wrapping), `StudentJoinPage.tsx` (one navigation-target line).
- **Expected tests**: `RequireStudent` unit test (redirects when `getCurrentUser()` resolves `undefined`, renders children when it resolves a student) mirroring `ChapterCard.test.tsx`'s `vi.mock('react-router-dom')` pattern; `ChapterPerformanceCard` unit test mirroring `ChapterCard.test.tsx`; `performanceService` unit test mirroring `authService.test.ts`'s `mockFetchOnce` pattern. No `DashboardPage` page-level test, matching this project's established convention (verified live instead — no page-level tests exist anywhere in this repo today).
- **Acceptance criteria**: A logged-out visit to `/dashboard` redirects to `/student/join`. A logged-in student sees their name and all 5 chapters. A chapter with recorded server-side performance shows it; a chapter with none shows no stats badge (matches acceptance criterion 1 in `Release-Plan-v1.0.md`).

### Slice 2 — Session configuration

- **Scope**: `StartPracticePage` form — mode selection (Practice default, Test opt-in, Revision), difficulty (`Easy/Medium/Hard/Mixed` only — matches `RequestedDifficulty` exactly, no free text), question count, time limit (rendered only when Test mode is selected). No API call yet; `handleSubmit` is a stub/mock at this slice.
- **APIs used**: None yet.
- **New files**: `pages/StartPracticePage.tsx` + `.css`, `components/SessionModeSelector.tsx` + `.css`, `types/session.ts` (new — `SessionMode`, `RequestedDifficulty`, request/response shapes mirroring `app/schemas/session.py`'s API-facing types exactly).
- **Modified files**: `App.tsx` (new guarded route).
- **Expected tests**: `SessionModeSelector` unit test — selecting Test mode reveals the time-limit field; selecting Practice/Revision hides it; difficulty options are exactly the four allowed values, no free-text control exists (directly enforces `Release-Plan-v1.0.md` §4.1's explicit UI omission of a question-type filter, and confirms no stray difficulty value can be submitted).
- **Acceptance criteria**: Test mode is never pre-selected by default (matches acceptance criterion 5). No control for question type exists anywhere on this screen (matches the RR1-identified no-op).

### Slice 3 — Session creation

- **Scope**: Wire the form's submit handler to a new `sessionService.createSession()`; handle `400` (zero selectable questions) inline, `401` via the guard's own redirect, network failure with a retry; on success, navigate to `/session/{sessionId}`; if `shortfall=true`, surface a one-line toast before navigating.
- **APIs used**: `POST /sessions`.
- **New files**: `services/sessionService.ts` (mirrors `authService.ts`'s `parseErrorMessage`/`credentials: 'include'` pattern exactly — every session route is session-gated).
- **Expected tests**: `sessionService.createSession` unit test mirroring `authService.test.ts`'s `mockFetchOnce` convention (success shape, `400` error message surfaced, `401` handling). `StartPracticePage` submit-handler test with `sessionService` mocked, confirming navigation only fires on success.
- **Acceptance criteria**: A configuration yielding zero questions shows the specific inline message from `Release-Plan-v1.0.md` §4.1, not a generic error. A successful creation always navigates to the new session's question screen next, never displaying raw question content on this page (matches ADR-007: `CreateSessionResponse` carries no question content by design).

### Slice 4 — Question experience

- **Scope**: `SessionQuestionPage`'s core loop: on mount, `GET current-question`; render via the reused `AnswerInput`/`DifficultyBadge`/`QuestionProgress` (`position + 1`); wire `AnswerInput`'s `onSubmit` to `sessionService.submitSessionAnswer({position, answer})` — **never** an `attemptNumber`, matching ADR-007's server-derived-attempt-number invariant structurally, not just by convention. Handle the initial `404` (session not found/not yours) and terminal `409` (route straight to `/session/{id}/complete` using the 409 body's own `SessionTerminalResponse`, no extra call).
- **APIs used**: `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer` (plumbed, minimal feedback rendering — full UX in Slice 5).
- **New files**: `pages/SessionQuestionPage.tsx` + `.css`.
- **Modified files**: `sessionService.ts` (add `getCurrentQuestion`, `submitSessionAnswer`).
- **Expected tests**: `sessionService.getCurrentQuestion`/`submitSessionAnswer` unit tests (success shape, `404`, `409` both variants — terminal body vs. stale-position).
- **Acceptance criteria**: Question 1 and a later question (e.g. position 4) render through the exact same code path, with no special-cased "first question" branch anywhere in the page — directly mirrors the backend property ADR-007 names as its own reason for existing. The request body sent to `POST answer` never contains a key named `attemptNumber` (verifiable by inspecting the actual request the mocked `fetch` receives in the unit test, the same way `authService.test.ts` already asserts request shape via `expect(fetch).toHaveBeenCalledWith(...)`).

### Slice 5 — Coaching feedback

- **Scope**: Layer the full response-driven UX onto Slice 4's page — `coach.message`, hint reveal (client-side `currentHintIndex`, reusing `HintPanel`), solution reveal (reusing `SolutionPanel`, reusing the `.hint-button`/`.hint-button-suggested` visual treatment for the suggested-hint nudge), and the advance control. On `sessionStatus !== 'in_progress'` in the answer response, navigate to Completion (fetching `correctCount` via one follow-up `GET /sessions/{id}` — `SubmitSessionAnswerResponse` doesn't carry it, a known, accepted gap per `Release-Plan-v1.0.md` §8's "not recommended" finding). On a stale-position `409`, silently re-fetch `current-question` and show a small non-error "Synced to your latest progress" notice, never a scary error banner.
- **APIs used**: `POST /sessions/{id}/answer` (full handling), `GET /sessions/{id}` (only when the final answer's response indicates a terminal status).
- **Modified files**: `SessionQuestionPage.tsx`.
- **Expected tests**: Extend `sessionService` tests for the `GET /sessions/{id}` summary call.
- **Acceptance criteria**: Matches acceptance criteria 3 and 7 from `Release-Plan-v1.0.md` verbatim — the `ui.canTryAgain/canRevealSolution/hintLevel` contract renders identically to the standalone flow's existing behavior, and a stale second-tab submission never surfaces as a visible error.

### Slice 6 — Session completion

- **Scope**: `SessionCompletePage` — fetches `GET /sessions/{id}` if not already reachable from Slice 5's terminal payload; renders `SessionCompleteSummary` with the mode-aware, status-aware copy from `Release-Plan-v1.0.md` §2 (Completion screen row): qualitative-only for Practice/Revision, self-feedback score for Test, distinct `expired`/`abandoned` framing. "Return to Dashboard" button.
- **APIs used**: `GET /sessions/{id}`.
- **New files**: `pages/SessionCompletePage.tsx` + `.css`, `components/SessionCompleteSummary.tsx` + `.css`.
- **Expected tests**: `SessionCompleteSummary` unit test — asserts no numeric score renders anywhere in the DOM for `mode: 'practice'`/`'revision'` (a real, checkable negative assertion, not just a positive one), and that a score does render for `mode: 'test'`.
- **Acceptance criteria**: Matches acceptance criteria 4, 5, 8, 9 verbatim.

### Slice 7 — Resume support

- **Scope**: New `sessionPointerService.ts`/`sessionPointerStore.ts` pair, mirroring `progressService.ts`/`progressStore.ts`'s exact split — a new, separate `localStorage` key (e.g. `mtc.session-pointer.v1`), storing `{studentId, sessionId, chapterId, mode}`. Slice 3's creation success writes the pointer; Slice 6's Completion (any terminal status) clears it. `DashboardPage` checks the pointer on mount, confirms liveness with one `GET /sessions/{id}`, and — only if the stored `studentId` matches the current logged-in student (guards against a PIN-swap to a different profile on a shared device) — shows `ResumeBanner`.
- **APIs used**: `GET /sessions/{id}` (liveness check only).
- **New files**: `services/sessionPointerService.ts`, `services/sessionPointerStore.ts`, `components/ResumeBanner.tsx` + `.css`.
- **Modified files**: `StartPracticePage.tsx`/`sessionService.ts` call site (write pointer on create), `SessionCompletePage.tsx` (clear pointer), `DashboardPage.tsx` (read + liveness check + banner).
- **Expected tests**: `sessionPointerStore`/`sessionPointerService` unit tests mirroring `progressStore.test.ts`/`progressService.test.ts` exactly (including the "corrupt/missing data falls back to empty, never throws" case). `ResumeBanner` unit test.
- **Acceptance criteria**: Matches acceptance criterion 6. Closing the browser mid-session and reopening it *on the same device* resumes correctly; a pointer for a different student never produces a banner (verified as a specific unit-test case, since it's a real, newly-introduced privacy-adjacent behavior on a shared device).

### Slice 8 — Final polish

- **Scope**: No new features — cross-cutting hardening. Full loading/empty/error-state audit across all four new pages against `Release-Plan-v1.0.md` §6's acceptance criteria one by one. Regression check of the untouched anonymous flow (`/chapters` → `/chapter/:id` → `/question/:id`, exactly as it works today). Documentation updates named in `Release-Plan-v1.0.md` §8 (`HANDOFF_PROMPT.md`, `PROJECT_STATUS.md`, `ProductArchitecture.md` new §19, `Roadmap.md`/`Backlog.md`, `Release-Notes.md`).
- **APIs used**: None new.
- **Expected tests**: Full `pytest` + `vitest run` + `tsc -b` + `oxlint` re-run fresh (not trusted from earlier slices, per this project's established practice).
- **Acceptance criteria**: All 11 acceptance criteria in `Release-Plan-v1.0.md` §6 individually confirmed via live walkthrough, not assumed.

---

## 4. Frontend state ownership

Explicitly checked against ADR-007's five listed invariants relevant to the frontend.

### Server-owned (source of truth is the backend; frontend never invents or locally mutates these without a round-trip)

- `SessionState` fields — `status`, `currentPosition`, `attemptsOnCurrentQuestion`, `correctCount`, `hintsUsedTotal`, timestamps. **The frontend must re-fetch `current-question`/re-read the answer response after every advance rather than incrementing a local position counter** — this is the direct frontend consequence of ADR-007's "SessionState is the only mutable state" and "Server owns attempt count" invariants.
- `SessionPlan` / `selectedQuestions` — immutable; the frontend only ever reads derived fields (`targetCount`, `totalCount`), never reconstructs or edits the plan.
- `QuestionContent` — fetched fresh per position via `content_repository.get_question_content()` (ADR-006/007's two-tier split); not cached across positions.
- `TopicPerformance[]` — server-computed aggregate, read-only.
- `CurrentUser` — server session identity, read via `authService.getCurrentUser()`.
- **The attempt number is never constructed on the frontend.** `sessionService.submitSessionAnswer` sends exactly `{position, answer}` — matching `SubmitSessionAnswerRequest` field-for-field — structurally enforcing ADR-007's "client never sends attempt numbers" constraint, not just following it by convention.

### Local UI state (component-scoped `useState`, ephemeral, never sent to the server, lost on navigation/reload)

- `AnswerInput`'s current text value.
- `currentHintIndex` — client-only, exactly as today's `QuestionPage`, since the full `hints[]` array is delivered upfront and the server has no concept of "hints revealed" (`hintsUsedTotal` stays 0 — a direct, explicit match to ADR-007's own Trade-offs section, not a new decision made here).
- `showSolution` boolean.
- Per-screen loading/error flags.
- `StartPracticePage`'s form field values before submission — never persisted if the student navigates away before submitting.

### localStorage state (the one deliberate exception, scoped narrowly per `Release-Plan-v1.0.md` §13)

- The session resume pointer only: `{studentId, sessionId, chapterId, mode}`, under a **new**, separate key (`mtc.session-pointer.v1`) — must not collide with Release 0.1's existing `mtc.progress.v1`, and the existing anonymous progress mechanism is completely untouched by this plan.
- Convenience cache only, never authoritative — a missing or stale pointer degrades to "no resume banner," never to lost progress, since every answer is already recorded server-side the moment it's submitted (ADR-007).

### Derived UI state (computed fresh every render from server state; never stored separately)

- 1-indexed display position (`position + 1`) from the 0-indexed server value — a presentation-only transform, matching ADR-007's own note that display indexing is a frontend concern.
- Which control shows (Try Again / Show Hint / Show Solution / Next Question) — derived every render from `coach.nextAction`/`ui.*`, exactly as `QuestionPage.tsx` already does today; never stored as separate state.
- Whether Completion shows a score — derived from `session.mode === 'test'`, never a separate flag that could drift from the actual mode.
- Whether `ResumeBanner` shows — derived from (pointer exists) AND (`GET /sessions/{id}` confirms a live, non-terminal status) AND (pointer's `studentId` matches the current user), recomputed on every `DashboardPage` mount, never cached beyond that check.

---

## 5. Routing review

### 5.1 Existing routes (unchanged)

| Route | Page | Guarded today? |
|---|---|---|
| `/` | `HomePage` | No |
| `/chapters` | `ChapterSelectionPage` | No |
| `/chapter/:chapterId` | `ChapterPage` | No |
| `/topic/:topicId` | `TopicPage` | No |
| `/question/:chapterId` | `QuestionPage` | No |
| `/teacher` | `TeacherAuthPage` | No |
| `/student/join` | `StudentJoinPage` | No |

**Finding, load-bearing for this plan**: no route in this app is guarded today, on the frontend, in any form. `authService.getCurrentUser()` exists but is called by zero pages. Only the backend enforces `401`s. This is why `RequireStudent` (§2.2, built in Slice 1) is real, necessary new work, not incidental — every one of the four new routes below requires it, since each calls a session-gated endpoint.

### 5.2 New routes

| Route | Page | Guarded |
|---|---|---|
| `/dashboard` | `DashboardPage` | Yes — `RequireStudent` |
| `/practice/:chapterId` | `StartPracticePage` | Yes |
| `/session/:sessionId` | `SessionQuestionPage` | Yes |
| `/session/:sessionId/complete` | `SessionCompletePage` | Yes |

Route naming deliberately avoids `/chapter/:chapterId` (already the old, anonymous `ChapterPage`) — `/practice/:chapterId` keeps the two parallel flows (anonymous direct practice vs. logged-in session-based practice) unambiguous at the URL level.

### 5.3 Navigation flow

```
Home (/)
  │
  ├─→ (unchanged) Select Chapter → Chapter Overview → Question   [anonymous flow, untouched]
  │
  └─→ Join a class / Teacher login
        │
        ▼
      StudentJoinPage — on success, navigate to /dashboard   ← the one change to an existing file
        │
        ▼
      Dashboard (/dashboard)
        │  pick a chapter
        ▼
      Start Practice (/practice/:chapterId)
        │  configure + submit
        ▼
      POST /sessions → Session Question (/session/:sessionId)
        │  loop: fetch → answer → coach → advance → refetch
        ▼
      (terminal status) → Session Complete (/session/:sessionId/complete)
        │  Return to Dashboard
        ▼
      Dashboard (/dashboard), performance refreshed
```

Resuming (Slice 7) re-enters at `Session Question (/session/:sessionId)` directly from the Dashboard's `ResumeBanner`, skipping Start Practice entirely — matching ADR-007's own point that resume requires no dedicated server-side code path, just re-calling the same read endpoint.

### 5.4 Guarded routes summary

Exactly the four new routes are guarded — this matches the backend's actual auth boundary precisely: only `/auth/*`, `/performance/me`, and `/sessions/*` are session-gated server-side (per `ProductArchitecture.md` §8); every existing frontend route calls only open endpoints and correctly stays unguarded.

---

## 6. Testing review

### 6.1 Unit tests (new)

Mirrors this project's existing 1:1 `tests/` ↔ `src/` convention exactly:

- `sessionService.test.ts` — mirrors `authService.test.ts`'s `mockFetchOnce`/`vi.stubGlobal('fetch', ...)` pattern: success shapes for all four session calls, `400`/`401`/`404`/`409` (both terminal-body and stale-position variants) error handling, and an explicit assertion that the answer-submit request body never contains `attemptNumber`.
- `sessionPointerStore.test.ts` / `sessionPointerService.test.ts` — mirror `progressStore.test.ts`/`progressService.test.ts` exactly, including the missing/corrupt-data-falls-back-to-empty case.
- `performanceService.test.ts` — mirrors `authService.test.ts`'s pattern for a single `GET`.
- Component tests for `RequireStudent`, `ChapterPerformanceCard`, `ResumeBanner`, `SessionModeSelector`, `SessionCompleteSummary` — mirror `ChapterCard.test.tsx`'s `render`/`fireEvent`/mocked-`useNavigate` pattern.

### 6.2 Integration tests

None planned, matching established project convention: **no page-level automated tests exist anywhere in this repository today** — `HomePage`, `ChapterPage`, `QuestionPage`, `TopicPage`, `TeacherAuthPage`, `StudentJoinPage` are all verified via live browser walkthrough only. The four new pages should follow the identical, already-established practice rather than introduce a new testing tier this codebase has never used.

### 6.3 End-to-end walkthroughs (live, before Slice 8 is considered done)

Directly reusing `Release-Plan-v1.0.md` §7's list, plus the ADR-007 concurrency case spelled out as its own explicit step per this milestone's deliverable 7:

1. Fresh student profile, full journey: login → Dashboard → Start Practice → Session Question (several positions) → Completion → Return to Dashboard.
2. Resume after a hard refresh mid-session.
3. Resume after closing and reopening the tab.
4. **The ADR-007 concurrent-submission scenario**: open the same session in two browser tabs at the same question. Submit a correct answer in tab 1 (server advances position). Submit any answer in tab 2, still holding the pre-advance position. Confirm the frontend receives the `409` and silently resyncs via a fresh `current-question` fetch with the "Synced to your latest progress" notice (Slice 5) — never a raw error screen. This is the one scenario in this plan that requires two real browser contexts to reproduce authentically; it cannot be faithfully exercised by a unit test alone.
5. A Test-mode session that exceeds its time limit → `expired` Completion variant.
6. A session left inactive past 4 hours (or timestamp-manipulated, matching the `_backdate()` pattern the backend's own `test_runtime_session_manager.py` already uses) → `abandoned` Completion variant.
7. Regression check: the pre-existing anonymous `/chapters` → `/chapter/:id` → `/question/:id` flow still works exactly as before, unchanged.

---

## 7. Implementation risks (grounded in this repository, not speculative)

1. **No frontend auth guard exists anywhere today.** Verified by reading every page in `frontend/src/pages/` — none call `authService.getCurrentUser()`. If `RequireStudent` (Slice 1) is skipped or delayed, every new session-backed route is reachable while logged out and will silently fail on its first API call with no redirect.
2. **`StudentJoinPage.tsx`'s current success branch is a dead-end.** It renders a "Welcome, {name}!" splash with only a "Back to Home" button — there is no test file pinning this behavior (no page-level tests exist), but it's a real, live production entry point today. Changing its post-login destination to `/dashboard` is a genuine edit to an existing file, not purely additive work.
3. **`ChapterCard.tsx`'s existing behavior is pinned by three tests** (`ChapterCard.test.tsx`) asserting an exact navigation target (`/chapter/{id}`) and exact badge text (`"{n} completed"`). Building `ChapterPerformanceCard` as a genuinely separate component (§2.2), not a modification of `ChapterCard.tsx`, is the concrete mitigation — editing `ChapterCard.tsx` directly to add a performance variant would risk breaking those three tests.
4. **`index.css`'s Vite-template CSS variables appear inert.** No existing page's `className` references `--accent`, `.counter`, or relies on `#root`'s fixed 1126px width for anything the app's actual layout depends on (verified by reading every component's CSS file). A new page that assumes these form a working theme layer would get an untested, unverified result.
5. **Position is 0-indexed server-side; every existing display convention is 1-indexed.** `QuestionProgress` and the `q-number` "Question X of Y" text both expect a 1-indexed value today. Reusing `QuestionProgress` unchanged (§1.1) requires `position + 1` at every call site — a real, easy-to-get-wrong seam between two already-shipped conventions, not a hypothetical one, since it only silently looks correct at `position === 0`.
6. **Advancing on `SHOW_SOLUTION` is a real, ADR-007-documented behavioral difference from today's flow.** `QuestionPage.tsx`'s existing "Mark Question Complete" button (shown after a solution reveal, requiring one more click before advancing) has no equivalent in the session API — the server has already advanced past the question the instant the solution was shown. If `SessionQuestionPage` copies that button literally, clicking it would act against a question the server no longer considers current, producing an unnecessary stale-position `409`. The new page's post-solution UI must be built around immediate advancement from the start.
7. **Test mode's time limit has no server-returned echo** (`Release-Plan-v1.0.md` §12, already identified, not new here). Any client-side countdown Slice 2/3 builds can only be seeded from the value the student just typed into the form — it will not survive a resume (Slice 7) without being rebuilt from memory the server doesn't have. The plan must not present a countdown as reliably persistent across a resume; it should be scoped as "accurate for the current in-memory session only."

---

## 8. Summary — how this maps to Milestone F1

Eight slices, in the dependency order above, each independently testable and each leaving the application in a working state (existing anonymous flow, existing teacher flow, and every previously-shipped page continue to function unmodified except the one named `StudentJoinPage.tsx` navigation change in Slice 1). No backend file, API contract, or ADR-006/007 decision is touched by any slice in this plan. Slice 8's documentation pass and full fresh test run are the gate before `Release-Plan-v1.0.md`'s own release checklist can proceed to its end-to-end walkthrough and `v1.0.0` tag.
