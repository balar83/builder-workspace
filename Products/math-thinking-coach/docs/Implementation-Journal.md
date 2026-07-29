# Implementation Journal — Milestone F1 (Student Learning Experience)

*Slice-by-slice implementation record for Milestone F1, per `Session-Frontend-Implementation-Plan.md`. Complements, not replaces, `Development-Journal.md` — this file tracks F1's slices specifically; a summary entry for each slice is also added to `Development-Journal.md`'s general engineering diary.*

---

## Sprint A — Complete the Learning Session Entry Flow (2026-07-29)

**Scope**: the full Dashboard → Session Configuration → Session Creation → First Question Loading path in one sprint, superseding the plan's original Slice 2/Slice 3 split and the display-only portion of Slice 4 — explicitly *not* another single-slice increment, per this sprint's own instruction. Answer submission is deliberately not implemented; the question screen stops immediately before it.

Per this sprint's documentation policy, only this file is updated — `PROJECT_STATUS.md`, `Development-Journal.md`, and `Release-Plan-v1.0.md` are left as they were after Slice 1, since nothing in this sprint uncovered a genuine architectural issue.

### Files added
- `frontend/src/types/session.ts` — `SessionMode`, `RequestedDifficulty`, `SessionStatus`, `CreateSessionRequest/Response`, `QuestionContent`, `CurrentQuestionResponse`, `SessionTerminalResponse`, and a `CurrentQuestionResult` discriminated union (`question` / `terminal` / `not-found`) so callers never have to re-derive which of `GET current-question`'s three real outcomes a response represents. `questionTypes` is deliberately absent from `CreateSessionRequest` — matching the plan's explicit instruction that no question-type control should exist, since `QuestionCandidate.type` is still always `null` (ADR-006).
- `frontend/src/services/sessionService.ts` — `createSession()`, `getCurrentQuestion()`. Mirrors `authService.ts`'s `parseErrorMessage`/`credentials: 'include'` pattern exactly. `getCurrentQuestion` branches on `409` (terminal, reads the session summary straight out of the error body per ADR-007 rather than a second call) and `404` (not found/not yours) before falling through to the live-question case.
- `frontend/src/components/SessionModeSelector.tsx` + `.css` — the configuration form controls: Mode (Practice/Revision/Test, plain-language descriptions), Difficulty (`Mixed`/`Easy`/`Medium`/`Hard` only), Number of questions, and Time limit — the last field renders only when Test mode is selected.
- `frontend/src/pages/StartPracticePage.tsx` + `.css` — the `/practice/:chapterId` screen: loads the chapter for display, holds `SessionConfig` as a single controlled object, validates question count and (Test-mode-only) time limit client-side before ever calling the API, calls `sessionService.createSession`, and navigates to `/session/:sessionId` on success — passing a shortfall message via router `state` when `response.shortfall` is true.
- `frontend/src/pages/SessionQuestionPage.tsx` + `.css` — the `/session/:sessionId` screen: fetches `current-question` on mount, renders it via the reused `QuestionProgress`/`DifficultyBadge`/`AnswerInput` (see Notable decisions), and handles all three `CurrentQuestionResult` cases plus a generic load failure with a graceful message and a "Back to Dashboard" link, never a raw error or a crash.
- `frontend/tests/services/sessionService.test.ts`, `frontend/tests/components/SessionModeSelector.test.tsx`.

### Files modified
- `frontend/src/App.tsx` — added `/practice/:chapterId` and `/session/:sessionId`, both wrapped in `RequireStudent` (Slice 1's guard, unmodified).
- `frontend/src/components/ChapterPerformanceCard.tsx` + `.css` — **"Start Practice" is now enabled.** The button navigates to `/practice/{chapter.id}` instead of being a disabled placeholder; the now-unreachable `:disabled` CSS rule was removed rather than left as dead code.
- `frontend/tests/components/ChapterPerformanceCard.test.tsx` — added the `react-router-dom` mock `ChapterCard.test.tsx` already established, replaced the "renders disabled" test with a "navigates on click" test.

### Tests added
- 12 new frontend tests (6 `sessionService`, 6 `SessionModeSelector`) plus 1 updated `ChapterPerformanceCard` test — full suite: **71/71 passing** (59 → 71). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**, re-run fresh.
- No page-level tests for `StartPracticePage` or `SessionQuestionPage`, matching this repository's established, unbroken convention — no page anywhere in this codebase has one; verified live instead (below).

### Notable implementation decisions
- **`AnswerInput` is reused, not hidden, and rendered fully `disabled`** (both the input and the button — confirmed via the live DOM, not just the prop), with a plain note ("Answering questions is coming in the next update.") beneath it. Rejected omitting it entirely: reuse-first per this sprint's own instruction, and it previews the real shape of the next sprint's work rather than a placeholder paragraph. Hint/solution reveal (`HintPanel`/`SolutionPanel`) are deliberately **not** rendered at all yet — both are thematically part of the answering experience this sprint explicitly stops before, not just cosmetically adjacent to it.
- **Shortfall messaging travels via React Router's `navigate(..., { state })`**, not a query string or new client-side store. It's read once on `SessionQuestionPage` via `useLocation()` and never persisted — a page refresh loses it, which is correct: the shortfall was a one-time fact about *that* creation, not an ongoing property of the session. No new dependency, no new abstraction.
- **`SessionQuestionPage` reuses `QuestionPage.css`'s classes directly** (`.question-header`, `.meta-row`, `.q-number`, `.question-card`, `.question-text`) via a direct import, exactly the reuse pattern Slice 1 established with `ChapterCard.css` — plus its own small `SessionQuestionPage.css` only for the shortfall notice and the answering-note text.
- **`StartPracticePage`'s "chapter not found" guard fires identically during genuine loading and a real 404**, deliberately matching `ChapterPage.tsx`'s own long-accepted convention (and its documented transient-flash trade-off from Feature 012) rather than inventing a three-state loading pattern nothing else in this codebase uses.
- **Client-side validation blocks the network call entirely** for a non-positive question count or (Test-mode-only) time limit — confirmed live: no `POST /sessions` fires when validation rejects the form.

### Live verification (both servers running)
- Full path, start to finish: real student join → Dashboard → "Start Practice" (now enabled) on Linear Equations → configuration form (Practice default; selecting Test correctly reveals the time-limit field, selecting Practice again correctly hides it; no question-type control exists) → set question count to 3 → Start Session → `POST /sessions` (200) → auto-navigated to `/session/{id}` → `GET current-question` (200) → **Question 1 of 3, Easy, question text, progress dots, disabled answer input, "coming in the next update" note — all rendered correctly, zero console errors.**
- **Shortfall**: requested 20 questions from Data Handling (5 total in the runtime bank) → session created with all 5 → question screen showed "Found 5 of 20 questions for this setup." above the first question.
- **Validation**: set question count to `0` on a real form → inline error shown, confirmed via the network log that no second `POST /sessions` request was ever sent.
- **Guard coverage on the two new routes**: logged out (via a real `/auth/logout` call, not a stubbed one) → direct visits to both `/practice/linear-equations` and `/session/anything` redirected to `/student/join`, exactly like `/dashboard` did in Slice 1.
- **404 handling**: logged back in, visited `/session/does-not-exist` → "This session isn't available." + Back to Dashboard, no crash, no raw error.
- Mobile viewport (375×812) checked on both the configuration form and the question screen — no overflow on either.
- Regression check: the pre-existing anonymous `/chapters` flow re-verified working identically.
- Test data (a second teacher/class/student and the sessions created above) removed from `backend/app/data/` afterward — all gitignored, none existed before this verification.

### Definition of Done
- [x] Sprint A implemented per instruction — Dashboard → Configuration → Creation → First Question, answer submission explicitly excluded
- [x] First question displayed from the Session Engine, live-verified
- [x] No answer submission implemented (confirmed via disabled DOM state, not just the absence of a handler)
- [x] Frontend tests passing — 71/71
- [x] Backend tests passing — 198/198 (unaffected, re-run fresh)
- [x] `tsc -b` / `oxlint` clean
- [x] No console errors (live-verified across every screen and edge case above)
- [x] Responsive layout confirmed (mobile viewport, both new pages)
- [x] Documentation updated — this file only, per Sprint A's explicit policy
- [ ] Commit — see this repository's `git log` for the resulting hash, recorded after commit

## Slice 1 — Student Authentication & Dashboard Foundation (2026-07-29)

**Scope, per the approved plan's §3 Slice 1**: `RequireStudent` route guard, `DashboardPage` shell (chapter list + server-side performance), the `StudentJoinPage → /dashboard` navigation change. Session creation, Start Practice's real functionality, and resume support are explicitly out of scope — deferred to Slices 2/3/7.

### Files added
- `frontend/src/types/performance.ts` — `TopicPerformance`, mirroring `app/schemas/performance.py` field-for-field. No frontend type existed for this response shape before this slice (it had no consumer).
- `frontend/src/services/performanceService.ts` — `getMyPerformance()`, `GET /performance/me` with `credentials: 'include'`. Returns `[]` on `401` rather than throwing (mirrors `authService.getCurrentUser()`'s existing 401-is-not-an-error convention) rather than surfacing an error state for a condition `RequireStudent` already guards against.
- `frontend/src/components/RequireStudent.tsx` — checks `authService.getCurrentUser()` on mount; redirects to `/student/join` (`replace: true`, so the guarded route doesn't remain in browser history) unless the resolved user's `role === 'student'`. Renders a `"Loading…"` state until the check resolves.
- `frontend/src/components/ChapterPerformanceCard.tsx` + `.css` — new sibling to `ChapterCard.tsx`, not a modification of it (see Notable decisions). Reuses `ChapterCard.css`'s classes (`.chapter-card`, `.chapter-card-content`, `.chapter-card-main`, `.chapter-desc`, `.chapter-progress-badge`) via a direct import, with its own small CSS file only for the two things that differ: a non-clickable card (`cursor: default`, no hover-lift) and the disabled "Start Practice" button.
- `frontend/src/pages/DashboardPage.tsx` + `.css` — the new `/dashboard` shell.
- `frontend/tests/services/performanceService.test.ts`, `frontend/tests/components/RequireStudent.test.tsx`, `frontend/tests/components/ChapterPerformanceCard.test.tsx`.

### Files modified
- `frontend/src/App.tsx` — added the `/dashboard` route, wrapped in `RequireStudent`.
- `frontend/src/pages/StudentJoinPage.tsx` — the post-join/login "Welcome" screen's button now navigates to `/dashboard` (was `/`), relabeled "Go to Dashboard" (was "Back to Home"). One line changed; the rest of the page (join/login form, error handling) is untouched.

### Tests added
- 10 new frontend tests (3 `performanceService`, 3 `RequireStudent`, 4 `ChapterPerformanceCard`) — full suite: **59/59 passing** (49 pre-existing + 10 new). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**, re-run fresh to confirm.
- No page-level test for `DashboardPage` itself, matching this project's established, repository-wide convention — no page has ever had one; page behavior is verified live instead (see below).

### Notable implementation decisions
- **`GET /performance/me` is keyed by `topicId`, not `chapterId`** (`attempt_service.get_performance` groups by `topic_id`, `WHERE topic_id IS NOT NULL`). Correlating a chapter to its performance therefore requires looking up that chapter's `Topic` first via the existing `questionService.getTopics(chapterId)`. `DashboardPage.loadDashboard()` fetches each chapter's topics in parallel and matches on `topics[0].id` against the performance list. A direct, necessary consequence of this: **a chapter with no `Topic` (Understanding Quadrilaterals, Practical Geometry, Data Handling, as of this commit) can never show a performance badge**, regardless of how many attempts a student makes there, since those attempts are recorded with `topic_id = NULL` and excluded from `get_performance` entirely. This is existing backend behavior, not something this slice changed or worked around — confirmed live (see below).
- **`ChapterPerformanceCard` is a new component, not a modified `ChapterCard`.** `ChapterCard.test.tsx` pins an exact navigation target and exact badge text against the existing component; editing it to add a performance variant risked breaking those three tests for no benefit, since the two cards serve different pages (anonymous `/chapters` vs. the new `/dashboard`) with different data sources (`localStorage` counts vs. server aggregates).
- **"Start Practice" renders as a real, visible, `disabled` button**, not hidden or a bare label — per the milestone's explicit instruction that Slice 2 owns its functionality. A `title="Coming soon"` tooltip is the only affordance; no `onClick` handler exists, since `/practice/:chapterId` doesn't exist yet.
- **No dedicated 401-driven redirect inside `DashboardPage` itself.** `performanceService.getMyPerformance()` degrades a `401` to `[]` rather than throwing, and `RequireStudent` is the single place that owns redirecting an unauthenticated visitor away from `/dashboard`. Avoids two different components independently deciding what an expired session means.

### Live verification (both servers running)
- Unauthenticated visit to `/dashboard` → redirected to `/student/join` (`RequireStudent` confirmed working before any real login existed).
- Registered a test teacher, created a class, joined as a student ("Asha") through the real UI (not stubbed) → "Welcome, Asha!" → "Go to Dashboard" → Dashboard renders the student's name and all 5 chapters, no performance badges (correct — fresh student, zero history).
- Submitted a real answer to a Linear Equations question via the standalone `/answer` endpoint (as the same logged-in student) → confirmed via `GET /performance/me` that the attempt was recorded → reloaded `/dashboard` → **Linear Equations alone showed "1 attempted · 0% accuracy"; the other 4 chapters (including Rational Numbers, which has a Topic but no attempts) correctly showed no badge** — validates the topic-correlation logic end-to-end, not just in a unit test.
- Mobile viewport (375×812) — chapter grid collapses to a single column, no overflow.
- No console errors at any point in the walkthrough.
- Regression check: the pre-existing anonymous flow (`Home → Select Chapter → ChapterCard`, still using `progressService`/`localStorage`) re-verified working identically, unaffected by any of this slice's changes.
- Test data (a teacher, a class, a student, and one attempt row) created for this walkthrough was removed from `backend/app/data/` afterward — all four files are gitignored and none existed before this verification.

### Definition of Done
- [x] Slice 1 implemented per plan
- [x] Application remains fully functional (anonymous flow re-verified)
- [x] Frontend tests passing — 59/59
- [x] Backend tests passing — 198/198 (unaffected, re-run fresh)
- [x] `tsc -b` / `oxlint` clean
- [x] No console errors (live-verified)
- [x] Responsive layout confirmed (mobile viewport)
- [x] Documentation updated — this file, `Development-Journal.md`, `PROJECT_STATUS.md`
- [ ] Commit — see `Development-Journal.md`'s entry for the resulting hash, recorded after commit
