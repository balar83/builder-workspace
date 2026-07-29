# ADR-006: Learning Session Planning Architecture (Milestone C1)

**Status:** Accepted
**Date:** 2026-07-28

---

## Context

The Scalable Assessment System's original scope named a "Question Selection Engine" (P3) — a component that would pick questions for a student. ADR-004 (identity) and ADR-005 (server-side attempt history) had, by this point, made two things real for the first time in this project: a known student, and a real per-topic accuracy/streak/mastery record for that student. Once those existed, "pick questions" turned out to have real upstream policy questions attached to it — how many, at what difficulty, weighted toward which weak topics, under which mode (practice/test/revision) — that a single selector function couldn't absorb without becoming several things at once.

A three-round design review (blueprint, refinement, final domain-model validation) elevated P3 from a narrow selector into a full session-planning architecture, then split it along the one property that actually mattered: which half needs a persistence decision. This ADR covers the stateless half — planning and selection with no database, no API route, and no student-visible surface of its own. The stateful half (session persistence and one-question-at-a-time serving) is ADR-007.

## Problem Statement

Given a raw `AssessmentRequest` (student, chapter, mode, and optional difficulty/question-type/count/time-limit overrides) and a student's real attempt history, how do you deterministically produce a concrete, ordered list of questions for a session — respecting mode-specific policy, respecting what content actually exists, excluding what the student has seen too recently — with:

- No AI, no ML, fully reproducible given the same seed
- No component reading question content it doesn't need
- No component able to reach into another's data source directly
- Full testability as pure functions, with no HTTP layer required

## Decision

Six plain-function service modules, each with one responsibility, composed by a thin pipeline function. No class hierarchy, no shared mutable state between modules — matches this project's existing plain-function-module convention (`evaluation_service.py`, `coaching_service.py`, etc.).

```
AssessmentRequest ──┐
                     ▼
  attempt_service ─→ StudentLearningContext ─→ SessionPlanner ─→ SessionPlan
                                                                       │
                             ┌─────────────────────────────────────────┘
                             ▼
  question_service ─→ ContentRepository ─→ QuestionCandidate[] ──┐
                                                                   ▼
                                              ConstraintResolver ─→ SelectionConstraints
                                                                        │
                                                                        ▼
                                              QuestionSelector ─→ SelectionOutcome
```

## Architecture

**`learning_context_service.build_learning_context(student_id, chapter_id)`** — reads `attempt_service` (ADR-005) fresh on every call, never cached or persisted. A topic counts as weak when it has been attempted, isn't yet mastered, and accuracy is below `WEAK_ACCURACY_THRESHOLD = 0.6` — a named, documented heuristic, not a tuned or pedagogically validated one. `recentQuestionIds` returns the last `RECENT_QUESTION_LIMIT = 10` questions the student was served, via `attempt_service.get_recent_question_ids()` (the one small extension this milestone added to that module). Every field is populated, never absent, even for a first-time student (`hasHistory=False`, empty collections).

**`session_planner.create_plan(request, context, seed)`** — the only module that sees both `AssessmentRequest` and `StudentLearningContext`; never touches question content. Mode is a strategy branch inside this one component, not three separate planners — an explicit, documented outcome of the second design-review round. `targetCount` defaults to `DEFAULT_TARGET_COUNT = 10` when the request doesn't specify one. Revision mode always applies the default Easy/Medium/Hard mixed distribution and populates `weakConceptTopicIds` from the context, ignoring any explicit difficulty the request carried; practice/test modes honor an explicit single-tier difficulty request or fall back to the same mixed default otherwise. The mixed split allocates 30% Easy / 30% Hard (`_MIXED_EASY_RATIO`/`_MIXED_HARD_RATIO`), with Medium absorbing the rounding remainder so the three counts always sum to exactly `targetCount` — matching the actual easy/medium/hard balance the content pipeline's own coverage reporting already documents, not an invented number. `seed` defaults to a fresh UUID when the caller doesn't supply one (production callers don't); everything downstream of plan creation is fully deterministic relative to whatever seed the plan ends up holding.

**`constraint_resolver.resolve_constraints(plan, candidates, exclude_question_ids)`** — a feasibility and degradation check only; it never selects an actual question. `resolvedCount` is always ≤ `requestedCount` and always honestly reflects what the candidate pool can supply after `exclude_question_ids` (the student's `recentQuestionIds`) is applied. Under-supplied tiers backfill in a fixed order — Medium → Easy → Hard (`_BACKFILL_ORDER`) — chosen because Medium is the broadest, most available authored tier. **This backfill applies uniformly even to an explicit single-tier request** (e.g. `difficulty="Hard"` on a pool with zero Hard questions still backfills from Medium/Easy rather than reporting a real shortfall) — a decision made during implementation, not settled by any prior design review, and named in the module's own docstring as something Test mode might want to override later. Not changed by this ADR; documented as shipped behavior.

**`content_repository.get_candidates(chapter_id, topic_ids)`** — the C1-side entry point of what becomes, in ADR-007, a two-tier Content Repository. Wraps `question_service`, normalizing each `Question` into a lean `QuestionCandidate` (id, chapterId, topicId, difficulty, type, sourceType, reviewStatus) — never the full display content. `type` is always `None` today; no question-type field exists on the runtime `Question` schema yet (P2, not built) — a documented no-op, not a bug. `reviewStatus` is hardcoded `"approved"`, since Stage 10 export (ADR-003) already gates on it before anything reaches runtime data; there is no second check to make here. Only one source adapter exists today (canonical/template-exported content); the module's own comment names the extension seam a future source (AI-generated, teacher-upload, PDF-extracted) would use — add a `_normalize_<source>` function, never fabricate a `QuestionCandidate` ad hoc. Not built; named only as where it would go.

**`question_selector.select(constraints, candidates)`** — never invents a constraint it wasn't given; only ever picks up to the count `SelectionConstraints` specifies per tier, from the exact candidate pool it was handed. Deterministic via `random.Random(constraints.seed)` — never wall-clock time. Selection order is Easy → Medium → Hard (`_TIER_ORDER`, independent of the resolver's backfill order, which governs how many per tier, not the order they're picked in). Returns `SelectionOutcome`, never a bare list — `actualCount`/`shortfall` are reported honestly, since the resolver's `resolvedCount` reflects pool-level feasibility but the selector's own exclusion pass can still under-deliver relative to it.

**`session_planning_pipeline.plan_session(request, seed)`** — thin composition of the five modules above, in the fixed order the architecture specifies. Deliberately not a named seventh architectural component — this is the glue ADR-007's Session Builder calls, not a permanent, independent piece of the design. The candidate pool is fetched exactly once and reused for both constraint resolution and selection, so the two steps can never disagree about what's actually available. For revision mode, `get_candidates` is called with `topic_ids=plan.weakConceptTopicIds` (when non-empty), narrowing the pool to weak topics *before* difficulty degradation runs at all.

**Enforced invariant, not just documented:** `test_session_planner.py::test_session_planner_never_imports_content_access` parses `session_planner`'s own source with `ast` and asserts `"app.services.content_repository"` and `"app.services.question_service"` never appear in its imports — a real, executable check that the planner cannot reach content, not a comment asking a future editor to remember.

## Alternatives Considered

- **One monolithic selector function vs. six decomposed modules.** Six modules chosen for single-responsibility testability and to match this project's existing plain-function-module convention; each module is independently unit-testable with no HTTP layer, which the actual test suite (pure `pytest`, no `TestClient`, anywhere in C1) confirms was achieved.
- **Mode-specific planners (separate Practice/Test/Revision planner components) vs. one planner with mode as an internal branch.** Rejected the former during the second design-review round as premature duplication of near-identical logic — recorded in `session_planner.py`'s own docstring, not invented for this ADR.
- **Persisting the plan/outcome in this milestone.** Explicitly not decided here — this is the exact property that split the original engine into C1 (stateless) and C2 (stateful, ADR-007). C1 has no database, no API route, and no persistence of any kind; this isn't a deferral within this ADR, it's the resolved reason this half of the architecture looks the way it does.
- **AI-assisted or ML-adaptive selection.** Never a candidate for this milestone's decision — excluded by `Product-Vision.md`'s deterministic-first stance, not weighed and rejected here as an implementation option.

## Trade-offs

**Pros**
- Fully deterministic and reproducible given the same seed — no dependency on wall-clock time or external state anywhere in the pipeline.
- Every module testable as a pure function; several tests assert against real content shapes (Linear Equations' actual 14/16/14 Easy/Medium/Hard split, Rational Numbers' actual 3/2/0 split), not just synthetic fixtures.
- The "planner never touches content" boundary is enforced by an AST-parsing test, not just a docstring.
- Recently-seen-question exclusion (`recentQuestionIds`) means a student starting a new session on the same chapter won't immediately be handed a question they just answered.

**Cons**
- Uniform tier-backfill on an explicit single-tier request can silently substitute a different difficulty than the student asked for — named, unresolved, not fixed here.
- `questionTypes` is fully wired through every schema and function signature but has zero filtering effect today, since `QuestionCandidate.type` is always `None` — a caller reading the type signatures alone could reasonably assume it's functional.
- `StudentLearningContext` is rebuilt from scratch on every planning call (no caching) — always current, at the cost of one full performance recomputation per session creation.

## Consequences

- Any future new content source (AI-generated, teacher-upload) must add a `_normalize_<source>` function inside `content_repository.py` rather than being read directly by `question_selector` — this is now an enforced architectural seam, not merely a suggested pattern.
- Because selection is seed-deterministic, a given `(plan, candidate pool, exclusions)` triple always produces the same `SelectionOutcome` — this makes exact session reproduction possible for debugging or support, without needing to persist the selected questions redundantly anywhere except the one place ADR-007 already does.
- `session_planning_pipeline.plan_session()` is now the single integration point any future caller (ADR-007's Session Builder, and only that, today) must use — no other module composes these five services together.

## Future Evolution

Only what implementation itself already flagged, not new proposals:

- **Uniform backfill on an explicit single-tier request** (`constraint_resolver.py`'s `_degrade`) — named in the module's own docstring as something Test mode may want to override. Not scheduled; revisit only if real use shows it matters.
- **`questionTypes` activation** — depends entirely on P2 adding a `type` field to the runtime `Question` schema, which has not been built. Until then this stays a documented no-op.

## Related ADRs

- [ADR-003](ADR-003-content-authoring-and-export-pipeline.md) — the `reviewStatus` approval gate `content_repository.get_candidates` trusts without a second check.
- [ADR-004](ADR-004-student-teacher-identity.md) — the identity layer `AssessmentRequest.studentId` and `StudentLearningContext` depend on.
- [ADR-005](ADR-005-server-side-attempt-history.md) — the real attempt data `learning_context_service` reads; this ADR's `get_recent_question_ids()` extension is the one addition C1 made to that module.
- [ADR-007](ADR-007-learning-session-runtime-architecture.md) — the stateful half this planning layer's output feeds into.

## Implementation Impact

**Backend** — New: `app/services/{learning_context_service, session_planner, constraint_resolver, content_repository, question_selector, session_planning_pipeline}.py`; `app/schemas/session.py` (`AssessmentRequest`, `StudentLearningContext`, `SessionPlan`, `SelectionConstraints`, `QuestionCandidate`, `SelectedQuestion`, `SelectionOutcome`). Modified: `app/services/attempt_service.py` (added `get_recent_question_ids()`, read-only).

**API** — None. No route in `app/api/*` calls any of this milestone's modules.

**Persistence** — None. Nothing in this milestone writes to any store.

**Tests** — 151/151 backend passing (94 → 151, +57), one file per module, plus the pipeline; all pure `pytest`, no `TestClient` anywhere in this set, by design — there is no HTTP surface to isolate.
