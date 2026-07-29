# Implementation Journal — Milestone F1 (Student Learning Experience)

*Slice-by-slice implementation record for Milestone F1, per `Session-Frontend-Implementation-Plan.md`. Complements, not replaces, `Development-Journal.md` — this file tracks F1's slices specifically; a summary entry for each slice is also added to `Development-Journal.md`'s general engineering diary.*

---

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
