# Release Plan — Version 1.0

**Project:** Math Thinking Coach
**Milestone:** RR1 — Release Readiness & Version 1.0 Planning
**Status:** Draft — pending approval. Planning artifact only; no code shipped under this milestone.
**Date:** 2026-07-29

---

## 1. Architectural blocker check

Verified fresh for this milestone, not carried over from memory:

- `git status` — clean, `HEAD` at `fd2cf60`, 20 commits ahead of `origin/main`, nothing uncommitted.
- Backend: 198/198 pytest passing.
- Frontend: 49/49 vitest passing.
- The Session Frontend UX review (prior milestone) found no architectural defect — every finding was additive and deferrable, and none required changing `SessionPlan`/`SelectedQuestions` immutability, `SessionState`-only mutability, the Content Repository access pattern, server-owned attempt counts, or per-request ownership checks.

**Conclusion: no architectural blocker exists.** The only pre-implementation gate is a documentation-discipline one, not a technical one — this project's convention (§5 of `HANDOFF_PROMPT.md`) is that ADRs record shipped decisions before further work builds on top of them, and ADR-006/007 haven't been written yet. See §14 for how that sequences against the Session Frontend itself.

---

## 2. Product vision (v1.0)

The first stable, end-to-end coaching experience a Class 8 CBSE student can use for daily, self-paced math practice — login through completed session through resumed progress — while remaining honest about what it isn't yet. Coaching, not grading, stays the default experience; scoring is opt-in and self-feedback-framed, never a gate. v1.0 is a foundation future milestones (Assessment Engine, teacher dashboard, more chapters) extend, not a finished product.

## 3. Target users

- **Primary (the actual v1.0 user): one Class 8 CBSE student**, using the product daily on what is realistically a single household device. This framing directly informs §13.
- **Secondary, present but dormant:** a teacher account can register and generate a class join code (Milestone A) — this exists today and isn't being removed, but no teacher-facing UI beyond class creation is in scope for v1.0. Teachers are not part of the v1.0 daily-use loop.
- **Not addressed in v1.0:** parents, additional students, multi-class management.

## 4. Scope

### 4.1 Included in v1.0

- Student login (existing `StudentJoinPage` — join and returning-login, unchanged)
- **Dashboard** (new) — chapter list, per-topic performance where history exists, resume banner
- **Start Practice** (new) — mode selection (Practice default, Revision, Test as an explicit opt-in), difficulty (`Easy/Medium/Hard/Mixed`), question count, time limit (Test only)
- Full session runtime: create → serve one question at a time → coaching feedback (existing `TRY_AGAIN/SHOW_HINT/SHOW_SOLUTION/NEXT_QUESTION` contract, unchanged since Feature 010/012) → advance → complete
- Resume via a client-side session pointer (see §13)
- Session expiry handling — Test-mode timeout and 4-hour inactivity abandonment, both surfaced with plain, non-punitive messaging
- **Completion screen**, mode-aware: no score for Practice/Revision, self-feedback score only for Test
- Return-to-Dashboard loop with refreshed performance data
- All 5 chapters exactly as they exist in runtime data today: Rational Numbers, Linear Equations (44 questions, has a Topic), Understanding Quadrilaterals, Practical Geometry, Data Handling (5 questions each, no Topic) — the Session Engine already reads all of them through the same Content Repository, no new content work is required to include them
- Existing Topic pages (Learn + Worked Example) for the 2 chapters that have one
- The pre-existing anonymous, no-login chapter/question flow — left running unchanged, since account creation should never be a hard requirement to practice

### 4.2 Deferred (not v1.0, not abandoned)

- Data Handling's 42-question pipeline expansion (§11 — evidence-based deferral, not a scope cut)
- Teacher-facing dashboard, class analytics (Milestone F / Phase 3)
- Milestone E — Assessment Engine's teacher-configured tests, marks, patterns
- Cross-device / cleared-storage session resume (`GET /sessions/active`) (§13)
- Migrating Practical Geometry, Understanding Quadrilaterals, or Data Handling onto the content pipeline (Topic + expanded banks)
- Confidence-gated live AI evaluation (blocked on Shadow Mode sample size, unrelated to this release)
- OCR, voice input, offline mode, multi-language, subscription model (Phase 2/5)
- Any student- or parent-facing surface for Shadow Mode — it stays logging-only and invisible by design

## 5. Known limitations (shipped honestly, not hidden)

- Resume works on the device/browser that created the session only (§13's trade-off, deliberately accepted for v1.0's single-user, single-device context)
- A Test-mode countdown that's dismissed and reloaded before the session ends currently has no server-returned `timeLimitMinutes` to rebuild itself from — narrow edge case, tracked in §12, not release-blocking
- No mid-session "quit intentionally" action — an abandoned session just sits until the 4-hour inactivity window closes it
- SQLite (`runtime.db`) is single-file/single-machine — correct for one household's traffic, not a multi-server design
- No teacher visibility into a student's live session
- `hintsUsedTotal` is always 0 — no hint-usage data exists anywhere in the system yet

## 6. Acceptance criteria

A build is v1.0-acceptable when all of the following hold, live-verified with a real browser session (not just green tests):

1. A student can log in via class code + name + PIN and land on a Dashboard showing their chapters.
2. From the Dashboard, a student can start a Practice session for any of the 5 chapters and immediately see question 1 of N.
3. Submitting a correct answer shows coaching feedback and a way to advance; submitting an incorrect answer offers a hint before a solution, matching the existing `ui.canTryAgain/canRevealSolution/hintLevel` contract exactly.
4. A Practice or Revision session's Completion screen never displays a score or percentage — only a qualitative summary.
5. Starting a Test-mode session requires an explicit, separate choice from Practice — never the default — and its Completion screen is the only place a score appears.
6. Closing the browser mid-session and reopening it on the same device resumes at the same question, via the same server-side session, with no answers lost.
7. Submitting from a second tab on a question already answered in the first tab does not error visibly — it resyncs silently to the server's actual position.
8. A Test-mode session that exceeds its time limit shows an "time's up" Completion state, not a hang or a generic error.
9. A session left untouched past 4 hours shows an "abandoned, nothing lost" Completion state the next time it's opened.
10. Returning to the Dashboard after a session reflects the newly recorded attempt in the performance view.
11. The pre-existing anonymous (no login) chapter/question flow still works exactly as before — unchanged, re-verified, not just assumed unaffected.

## 7. Testing expectations

- **Backend:** no session-API changes are planned for this release (§13 declines the one candidate endpoint); 198/198 must hold as the pre-flight baseline, re-run fresh immediately before tagging.
- **Frontend:** new components/services get vitest coverage mirroring `src/` 1:1, per this project's existing convention. Page-level behavior (Dashboard, Start Practice, session-driven Question/Completion) is verified via live browser walkthrough — consistent with this project's established practice of never unit-testing pages, not a new gap introduced here.
- **Dedicated end-to-end walkthrough before tagging**, covering: fresh student profile through the full journey (login → dashboard → session → completion → return); resume after a hard refresh; resume after closing and reopening the tab; a stale second-tab submission; a Test-mode expiry (real or timestamp-manipulated, matching the `_backdate()` pattern C2's own tests already use); an abandoned-session state; the untouched anonymous flow as a regression check.
- Both suites (`pytest`, `vitest run`) plus `tsc -b` and `oxlint` must be clean immediately before the v1.0 tag — not trusted from an earlier slice.

## 8. Documentation status

None of the following are updated yet — that is Definition-of-Done work for the Session Frontend implementation itself, not for this planning milestone:

| Document | What v1.0 requires of it |
|---|---|
| `ADR-006`, `ADR-007` | Written (see §14) — prerequisite, not just accompanying |
| `HANDOFF_PROMPT.md` | Regenerated at the v1.0 checkpoint |
| `PROJECT_STATUS.md` | Milestone RR1 + Session Frontend entries |
| `ProductArchitecture.md` | New §19 for the Session Frontend's screens/routes, mirroring §6's Progress Persistence write-up |
| `Roadmap.md` / `Backlog.md` | Session Frontend moved from "recommended next" to shipped; Data Handling's expansion re-filed as deferred, not dropped |
| `Release-Notes.md` | First entry with real user-facing surface for the Learning Session Engine |
| This file | Becomes the historical record of what "v1.0" meant once tagged — not rewritten after the fact |

## 9. Release checklist

1. ADR-006 and ADR-007 written and accepted.
2. Session Frontend implemented in small, independently-testable slices (§5 of `HANDOFF_PROMPT.md`'s workflow, unchanged).
3. Backend `pytest`, frontend `vitest run` + `tsc -b` + `oxlint` all clean, re-run fresh.
4. End-to-end walkthrough (§7) completed and its findings resolved.
5. All acceptance criteria (§6) individually confirmed, not assumed from the walkthrough alone.
6. Documentation table in §8 fully updated.
7. `git status` clean; `release/v1.0` branch created per §10.
8. Tag cut per §10's convention.
9. `origin` push decision made explicitly with the user (20+ commits currently unpushed — don't assume this release resolves that silently).

---

## 10. Git strategy

The repository currently has a single `main` branch, no `develop`, no release branches, no tags — this is a fresh strategy, not a retrofit.

- **`main`** — always reflects the latest reviewed, tested state, exactly as it does today. Stays the integration branch; nothing changes about how it's used up to v1.0.
- **`develop`** — introduce only once Session Frontend work is actually multi-slice and concurrent enough to need a buffer between `main` and a release cut. Given this project's small-slice-at-a-time discipline and single-developer-per-session workflow, a standing `develop` branch is optional overhead, not a hard requirement — recommend skipping it unless the Session Frontend implementation turns out to need several parallel-in-flight slices.
- **`feature/*`** — one branch per Session Frontend slice (e.g. `feature/session-dashboard`, `feature/session-question-flow`), each merged to `main` (or `develop`, if adopted) once its own tests pass, matching the existing small-commit convention already visible in `git log`.
- **`release/v1.0`** — cut from `main` once §9's checklist items 1–6 are complete. Exists to allow final stabilization (walkthrough fixes, doc polish) without blocking new work from starting against `main`. Merged back to `main` on completion.
- **Tagging** — annotated tag `v1.0.0` on the commit that merges `release/v1.0` back into `main`, using this project's existing Conventional-Commits discipline for the tag's accompanying message (a summary of what v1.0 delivers, referencing this file). Semantic versioning from here forward: `v1.0.x` for fixes with no scope change, `v1.x.0` for additive milestones (e.g. Data Handling's export, once approved, would ship as `v1.1.0` — a scope addition, not a patch).

## 11. Data Handling export recommendation

**Recommendation: do not export before v1.0.** This is a content-review-readiness finding, not a preference:

- `docs/content-source/data-handling/stage6-questions.json` carries file-level `reviewStatus: "ai-generated"` — every question inherits this (no question sets its own `reviewStatus`, so the approval gate's per-question override never fires).
- Running the actual export tool confirms this live: `node docs/content-pipeline/export/run.js --chapter=data-handling --dry-run` reports **0 topics exported, 0 questions exported, 42 questions rejected, 0 validation errors** — the rejection is entirely the approval gate, not a data-quality problem.
- There is no `canonical-topic.json` for Data Handling at all — unlike Linear Equations, its Topic content was never consolidated, so even a Topic page for this chapter isn't ready.
- The approval gate exists specifically so AI-generated content never reaches a student without human review (ADR-003) — bypassing it would defeat the one safeguard that pipeline was built for, and reviewing 42 questions for a Class 8 curriculum is real educational work, not something to wave through under a release deadline.

This doesn't shrink v1.0's chapter coverage — **Data Handling is already live today** with its original 5 hand-seeded questions, and the Session Engine already serves it like any other chapter. The only thing deferred is the *upgrade* from 5 to 42 questions, which is correctly modeled as its own future release (§10's `v1.1.0`) once someone actually reviews the content and flips `reviewStatus` to `"approved"`.

## 12. UX gap classification

Carried forward from the prior UX review, each gap re-graded against actual v1.0 requirements:

| Gap | Classification | Evidence-based reasoning |
|---|---|---|
| No "list my active session" endpoint (`GET /sessions/active`) | **Future enhancement** | Only matters for cross-device/cleared-storage resume, which §3 establishes isn't v1.0's usage pattern. See §13. |
| `timeLimitMinutes` not returned by any read endpoint | **Should fix after v1.0** | Only breaks a countdown reconstruction after a Test-mode session is reloaded mid-flight — narrow, Test mode is opt-in and not the default daily-use path (§4.1), doesn't block acceptance criterion 8 (expiry itself is still enforced correctly server-side regardless of what the client displays). |
| `SubmitSessionAnswerResponse` omits `correctCount` | **Future enhancement** | One extra `GET /sessions/{id}` call on session completion is negligible cost; no user-facing effect. |
| No mid-session "quit intentionally" action | **Should fix after v1.0** | Not release-blocking (student can just navigate away), but a daily-use product benefits from letting a student cleanly abandon a misconfigured session instead of waiting out a 4-hour window before the Dashboard stops nagging them to resume it. Worth a product decision once real daily use surfaces it as an actual annoyance, not before. |
| `hintsUsedTotal` always 0 | **Future enhancement** | No regression — today's flow doesn't report this either. Only matters once something (teacher dashboard, analytics) actually consumes it. |
| Shortfall has no "why" (`shortfall`/`actualCount` without a reason) | **Future enhancement** | Cosmetic; the honest count is already sufficient for v1.0's single-student context. |
| Narrow same-position concurrent-write race (two truly simultaneous requests) | **Must fix before v1.0 — verify, not necessarily code** | The single most technically real finding from the UX review. Given v1.0 is one student on one device, this is extremely unlikely to occur in practice, but §7's end-to-end walkthrough should include a deliberate two-tab stale-submission test (acceptance criterion 7) to confirm the existing 409 guard behaves correctly under real conditions before shipping, since it's cheap to verify and expensive to discover from a confused daughter mid-homework. |

No finding from the UX review requires a backend code change to reach v1.0.

## 13. localStorage session pointer — sufficiency for v1.0

**Recommendation: sufficient. Do not build `GET /sessions/active` for v1.0.**

The product justification bar the user set (§6 of the RR1 request) is "strong product justification," and none exists yet:

- v1.0's actual target user (§3) is one student on what is realistically one shared household device — the scenario `GET /sessions/active` solves (a *different* device, or a *cleared* browser, needing to discover an in-progress session it has no memory of) isn't this product's real usage pattern today.
- The client-side pointer pattern isn't new or risky — it's the same mechanism Release 0.1's `progressStore.ts` already uses in production, just session-scoped instead of chapter-scoped. It is a convenience cache only; the server's session record stays authoritative, and a missing/cleared pointer degrades to "no resume banner shown," never to lost progress, since every answer is already recorded server-side the moment it's submitted.
- Building the endpoint now, before any evidence it's needed, is exactly the kind of speculative addition both this project's `Product-Vision.md` ("extend on evidence, not speculation") and this milestone's own instructions ask to avoid.

If real usage later surfaces a genuine need (a second device, a shared family tablet reused by siblings, a browser that gets cleared often), that's the evidence to revisit this against — not a hypothetical today.

## 14. Recommended implementation order

1. **ADR-006** (Learning Session Planning Architecture) — written first because it documents C1, which is already fully shipped and stable; nothing in this release plan changes its scope, so there's no reason to sequence it after anything else.
2. **ADR-007** (Learning Session Runtime Architecture) — immediately after, same reasoning for C2. Both ADRs should explicitly note the two conditional API extensions from §12/§13 as evidence-gated future work, not commitments, so the ADR doesn't need revisiting when/if they're eventually built.
3. **Session Frontend implementation** — only after both ADRs are accepted, per this project's own stated convention that architecture gets documented before more is built on top of it. Implemented in the small, independently-testable slices §9 describes, in journey order (Dashboard → Start Practice → session runtime/Question/Coaching → Completion → resume/expiry handling), since each slice is a natural dependency of the next and matches how the UX review itself was structured.
4. **End-to-end testing** (§7) — after the full journey is implemented, not per-slice; this is where the acceptance criteria (§6) get checked as a whole, including the concurrency verification §12 flags.
5. **Version 1.0 tag** — only after §9's full checklist is satisfied, per §10's tagging convention.

This order exists because ADR-006/007 are cheap, low-risk, and already-earned (the architecture is done and stable per this milestone's own finding in §1) — writing them first removes any temptation to let Session Frontend implementation quietly reinterpret a decision that was never actually written down.
