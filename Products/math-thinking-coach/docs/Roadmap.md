# Roadmap
**Project:** Math Thinking Coach
**Status:** Living document — capability themes and rough sequencing, not a commitment ledger. Updated as priorities change.

**2026-09-02 — Product Strategy Reset.** See [`Product-Vision.md`](Product-Vision.md) for the full North Star, learner journey, common product model, and GenAI strategy. This reset **supersedes** the "Scalable Assessment System" section's original framing below, which resolved Test/Assessment as a permanently teacher-facing surface — that resolution was correct for the milestone it scoped in 2026-07-28 and is preserved as history (do not edit the historical entries), but is no longer forward-looking guidance. A new "North Star Capability Model" section (below) reorganizes this roadmap's near/medium/long-term items against the 12 target capabilities; treat it as the current lens for prioritization.

---

## How to read this document

This file sits between two others and should not duplicate either:

- [`Idea-Inbox.md`](Idea-Inbox.md) — raw, unfiltered, timestamped capture. No prioritization.
- **Roadmap.md (this file)** — ideas that have graduated to a named capability theme with rough sequencing and known dependencies. Still not approved for implementation.
- [`Backlog.md`](Backlog.md) — the next 1 (occasionally 2) items, scoped and approved, ready for an implementation prompt.

Per `AI-Builder-OS/CLAUDE.md`, this document is intentionally exempt from the "documentation reflects only completed reality" rule — it exists to hold future plans.

---

## Phase 1 — Core Coaching Loop (Complete)

*Retroactively labeled during this sprint. `ProductArchitecture.md`'s roadmap previously started at "Phase 2," leaving everything already built without a phase name.*

- Frontend MVP: chapter selection → chapter detail → multi-question flow → progressive hints → solution reveal
- Backend foundation (FastAPI, `/api/v1`)
- Question/chapter retrieval API
- Rule-based answer evaluation (exact-match, trimmed)
- Coaching UI state wired into `QuestionPage`
- Evaluation/coaching responsibilities separated behind a service seam (Feature 012 — see [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md))
- Local AI evaluation spike, isolated from production (Feature 014)

Success criteria met — see `ProductArchitecture.md` §13: a Class 8 student can select a chapter, attempt a question, receive guided hints, and reveal the full solution only when needed.

---

## Near-term

**Feature 015 — Shadow Mode AI Evaluation — ✓ Complete (2026-07-23).**
Runs the Feature 014 AI evaluator alongside the rule-based evaluator on real traffic, out-of-band via `BackgroundTasks`, logging JSONL, feature-flagged via `SHADOW_MODE_ENABLED` (default on). Zero live behavior change — verified. See [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) and `Development-Journal.md`'s 2026-07-23 entry.

**Release 0.1 — "It Remembers You" — ✓ Complete (2026-07-27).**
Client-side progress persistence (Feature 016) and the UI that makes it visible: a real Chapter Overview, a question flow that resumes where it left off, and a working "Continue Learning" (Feature 017). Zero backend changes — ADR-001 and ADR-002 both unaffected. See `Development-Journal.md`'s 2026-07-27 entries and `ProductArchitecture.md` §6.

**Release 0.2 — first slice: Content Pipeline & Topic Delivery — ✓ Implemented (2026-07-27), Linear Equations only.**
Delivered, in parallel with Release 0.1 the same day: a `Topic` data model and retrieval API (Feature 018), a seeded/validated procedural question generator ("Template Engine v1," Feature 019), a 5-stage content-authoring trail with an approval gate (Feature 020), and a Stage 10 Export Pipeline that atomically merges approved content into runtime data against the real backend Pydantic schemas (Feature 021). Linear Equations migrated end-to-end (5 → 44 questions, 1 Topic, live and tested); Data Handling authored through stage 6 (42 questions) but not yet exported. This is a first slice of Release 0.2's LXA mapping (Learn + Worked Examples), not the whole release — see `LearningExperienceArchitecture.md` §7. Full detail in `Development-Journal.md`'s 2026-07-27 entries and [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md).

Superseded by Release 0.1.1 (Data Handling exported) and Release 0.1.2 (see `PROJECT_STATUS.md`'s Engineering Milestone log for the full sequence since). Shadow Mode continues accumulating real evaluations unchanged since Feature 015. Current next-work sequence: see `Backlog.md`'s "Recommended Next."

---

## Scalable Assessment System (milestone, sequenced 2026-07-28)

**Historical framing note (2026-09-02):** the paragraph immediately below records what was actually decided on 2026-07-28 and is left unedited as history — including its "teacher-facing surface" resolution, which `Product-Vision.md`'s 2026-09-02 reset has since superseded as forward-looking guidance (see that document's "Assessment Is Not Inherently Teacher-Only" and "What This Reset Supersedes"). The milestones below (A, B, C1, C2, F, F1) are all real, shipped, and unaffected by the reset — they built a working assessment engine, which is exactly what the new direction needs; only the "who may reach it" framing changes, not the engine itself. Milestone E (below) was never built — its scope should be re-reviewed against the new direction, not resumed as originally specified.

Design-reviewed before any code, per the project's workflow. Two decisions shaped the sequencing: (1) `Product-Vision.md`'s Coaching vs. Assessment Philosophy is preserved — assessments/marks are a **teacher-facing surface**, the student coaching experience stays formative and unscored, not a product pivot; (2) auth was identified as an invisible prerequisite for attempt history, adaptive selection, and teacher features alike, and pulled out as its own milestone rather than assumed away.

- **Milestone A — Student/Teacher Identity — ✓ Implemented (2026-07-28).** Minimal auth: teacher accounts, class join codes, student identity with no email/PII collected from minors. Shipped dormant — see [ADR-004](ADR/ADR-004-student-teacher-identity.md) and `Development-Journal.md`'s 2026-07-28 entry.
- **Milestone B — Server-side attempt history — ✓ Implemented (2026-07-28).** SQLite-backed attempt log + deterministic per-topic accuracy/streak/mastery aggregates, resolving the persistence question Milestone A deferred. Session-gated for logged-in students only; makes Milestone A non-dormant. See [ADR-005](ADR/ADR-005-server-side-attempt-history.md).
- **Milestone C — Learning Session Engine**, superseding the original "Milestone C/D — Question Selection Engine" framing after three design-review iterations (blueprint, refinement review, final domain-model validation) elevated the scope to a full session-planning orchestration layer, with Question Selector as one internal component rather than the whole milestone. Split in two, matching the property that only one half needs a persistence decision:
  - **C1 — Stateless planning layer — ✓ Implemented (2026-07-28).** `StudentLearningContext`, Session Planner, Constraint Resolver, Content Repository, Question Selector, `SelectionOutcome` — six plain-function modules, fully deterministic (seeded selection, rule-based degradation, no ML), reading real data from Milestone B. Extends ADR-003's content pipeline rather than replacing it, with an explicit future slot for AI-generated content.
  - **C2 — Stateful session runtime — ✓ Implemented (2026-07-28).** `session_store.py` (SQLite, `runtime.db` — renamed from `attempts.db` in this same change), Session Builder, Runtime Session Manager (`get_current_question`/`submit_answer`, lazy `expired`/`abandoned` transitions, server-derived attempt numbers), and four new API routes closing the "never expose the complete question bank" gap — question 1 and question 10 now share one code path. Backend-only; no frontend consumes it yet.
  - **ADR-006 (planning) and ADR-007 (runtime) — ✓ Written and Accepted (2026-07-29).** Both finalize the Learning Session Engine's architectural record; see `PROJECT_STATUS.md`'s 2026-07-29 documentation entry.
- **Milestone E — Assessment Engine, teacher-facing surface with a student-facing opt-in Test mode.** Marks, patterns, configurable tests (practice/test/revision) — built on top of the now-complete Learning Session Engine (C1+C2) rather than a separate parallel milestone. Resolved against `Product-Vision.md`'s Coaching vs. Assessment Philosophy during the 2026-07-28 design review: default coaching stays score-free; Test mode is a distinct, explicitly-opted-into surface with a self-feedback summary. Question types phased — MCQ/True-False/Fill-in-blank/Match-the-following/Short-Answer first (rule-based); Long Answer/Multi-step Solve/Higher-order-thinking deferred until Shadow Mode's confidence-calibration gap (Feature 014) closes, since those types need live AI evaluation to grade reliably. The degradation-policy refinement (`SessionPlan.degradationPolicy`, `SelectionOutcome.substituted`) accepted in C2's design review but not implemented is a natural piece of this milestone's scope. **Partially superseded**: M2 (below) delivered `single_choice`/`multi_choice` evaluators independently of this milestone, ahead of a full Assessment Engine.
- **Milestone F — Professional UI/UX redesign.** Started (2026-07-28) with a concrete, measured finding: the Question page's per-question progress-dot grid scales linearly and was verified to consume 286px of a 375px-wide mobile viewport at Linear Equations' current 44-question count. Proposal: single progress bar, true progressive disclosure of hints/solution, one primary action at a time. **Superseded by Release 0.1.2** (2026-08-07), which delivered a full design-token system and rebuilt question experience — see `PROJECT_STATUS.md`. A frontend for the Learning Session Engine (C1+C2) shipped as Milestone F1 (2026-07-29, Session Frontend) — see below.
- **Milestone F1 — Student Learning Experience / Session Frontend — ✓ Complete (2026-07-29).** Dashboard, Session Configuration, Session Creation, Question/Coaching loop, Completion, Resume — the frontend Milestone F named as a related need. See `PROJECT_STATUS.md`.

E is not implemented yet (F/F1 are, see above) — needs its own implementation-ready design pass before code, per this project's workflow.

---

## Question & Response Semantics (M2, sequenced 2026-08-17)

Not part of the original "Scalable Assessment System" milestone sequencing above — a separate initiative addressing the answer-matching brittleness named in `Phase-1-Handoff.md` §12.1/§13.5 (exact-string matching rejects mathematically-equivalent or differently-formatted correct answers). Design record: `Question-Response-Semantics-Design-Proposal.md` (Parts I and II). Architecture: [ADR-008](ADR/ADR-008-question-response-evaluation-architecture.md).

- **M2.1 — Question Response Semantics Foundation — ✓ Complete (2026-08-17, `e41670a`).** `questionType`/`responseSpecification` added additively to `Question` (default `short_text`); `Evaluator` protocol + registry dispatch; `numeric` evaluator (Fraction-based comparison).
- **M2.2 — Single Choice — ✓ Complete (2026-08-17, `87e8414`).** `single_choice` evaluator, options public/answer private per ADR-001's boundary; frontend `QuestionResponseInput` dispatch component + `SingleChoiceInput`.
- **M2.3 — Multi Choice — ✓ Complete (2026-08-17, `e120a1d`).** `multi_choice` evaluator, exact-set (all-or-nothing) comparison; frontend `MultiChoiceInput`.
- **M2.4 — Content Activation Pilot — ✓ Complete (2026-08-17, `2e0205d`).** First real content activation: Linear Equations converted to 3 single_choice/2 multi_choice/28 numeric/11 short_text (44 questions, count and difficulty split unchanged). A capability slice (M2.1–M2.3) had shipped with zero production content using it until this slice. See `Development-Journal.md`'s 2026-08-17 (M2.4) entry and `Question-Response-Semantics-Design-Proposal.md`'s pilot-chapter reconciliation note.
- **Squares & Cubes content import — ✓ Complete (2026-08-19, `a071335`).** 40 → 52 questions via the existing Stage 10 pipeline, unrelated to M2's evaluator work.

**Updated 2026-09-16 — done.** `multi_part` shipped as M3, scoped to exactly `le-q25`/`le-q37`/`le-q40`, as part of the 2026-09-16 release alongside Self-Serve continuation, D1 (concept-level performance), and telemetry/mastery activation. See `PROJECT_STATUS.md`'s "Engineering Milestone" and `Development-Journal.md`'s 2026-09-16 entry.

---

## Content Expansion + Chapter Lesson-Page UX (sequenced 2026-09-02)

Two milestones, both complete and live, sequenced after M2/Squares & Cubes and before the Product Strategy Reset (which this section predates by hours, not days — recorded here in delivery order):

- **New chapter: Exponents and Powers, and 6-chapter expansion to 420 questions total — ✓ Complete (2026-09-02, commit `112ace7`).** New chapter (60 questions, from the provided NCERT Class 8 Ch.10 source) plus all 6 existing chapters expanded toward a 60-question exam-practice target each: Squares and Cubes 52→60, Linear Equations 44→60, Data Handling 42→60, Understanding Quadrilaterals 40→60, Rational Numbers 40→60, Practical Geometry 35→60. Content-only, through the existing Stage 10 pipeline (0 validation errors); an independent 7-way QA pass (one reviewer per chapter, each re-deriving every new answer from scratch) found zero blocker issues across all 227 new questions. See `Development-Journal.md`'s 2026-09-02 entry.
- **Chapter Lesson-Page Progressive Disclosure + Practice CTA — ✓ Complete (2026-09-02, commit `44b98b7`).** Follow-up UX investigation (learner/teacher journey review, lesson-page UX review, test-coverage review, exam-prep capability review, and a scoped AI/GenAI assessment) found the chapter lesson page forced ~6 screens of scroll before a learner could reach Start Practice, with no in-page navigation despite existing per-concept anchor ids. Fixed: jump-to-section nav (reusing existing anchor ids unchanged), a second Start Practice CTA near the top, worked examples collapsed behind native `<details>` (first one open, rest collapsed), learning objectives collapsed behind a count badge. Frontend-only, no backend/schema/content changes. Added the repository's first true multi-page-navigation regression test (`frontend/tests/pages/TopicPage.test.tsx`), using the existing Vitest/RTL stack with a real `react-router-dom` rather than a new E2E framework — see `Backlog.md` for the scope reasoning.

**That same investigation is the direct source of this roadmap's 2026-09-02 reset** (`Product-Vision.md`) and the "North Star Capability Model" section immediately below — the biggest finding wasn't a missing feature, it was that most of what the North Star journey needs (Test mode, Revision's weak-topic targeting, per-concept performance) already exists but is reachable only through the class-joined flow.

---

## North Star Capability Model

**Partially stale as of 2026-09-16 — not re-audited row by row in this pass, per this release's own scope discipline (release-relevant documentation only, no wholesale product-strategy rewrite).** The Self-Serve Learning Loop V1 commits (`2335c8a`…`8187e98`, 2026-09-03 to 2026-09-09, backfilled into `Development-Journal.md`/`Backlog.md` this same day) shipped real self-serve reach for several rows below that the table still marks "class-joined only": Revision discoverability (#6), Wrong-Answer Review (#5), Recovery Metrics (#8/#9-adjacent), and — via Slice 5 "Runtime Remediation" — the "Export authored misconception content" near-term item is **done**, not still-pending as listed below. D1 (concept-level performance, 2026-09-16) adds a self-serve-reachable per-concept view relevant to #5/#8 as well. A full re-audit of this table against actual shipped capability is recommended as its own documentation pass, not attempted here.

Organizes this roadmap's forward-looking items against the 12 capabilities named in `Product-Vision.md`'s North Star. **Current** = shipped and reachable by *some* learner today (even if only the class-joined flow); **Target** = what the capability needs to look like; a capability with no current entry is entirely unbuilt.

| # | Capability | Current | Target (this reset) |
|---|---|---|---|
| 1 | Learn | ✅ Understand stage, 7/7 chapters, both flows | Comprehension check (still unbuilt) |
| 2 | Practice | ✅ Both flows | Independent/Homework practice framing (unbuilt) |
| 3 | Diagnose | ❌ Not built | Match a wrong answer to authored misconception content — see near-term below |
| 4 | Remediate / Fix | ❌ Not built (content exists, unexported) | Surface `remediationHint` on a matched wrong answer |
| 5 | Review | ⚠️ Partial (Dashboard concept-review reopens the lesson, not missed questions) | A learner-facing view of specifically what they got wrong |
| 6 | Revise | ⚠️ Weak-topic-targeted Revision mode exists, class-joined only | Self-serve reachable; explained to the learner, not silent |
| 7 | Assess | ✅ Test mode, class-joined only | Self-serve reachable — see `Product-Vision.md`'s "Assessment Is Not Inherently Teacher-Only" |
| 8 | Understand readiness | ⚠️ Deterministic Mastery only, class-joined only | Mastery/Fluency/Transfer/Readiness distinctly measured (future, not scoped) |
| 9 | Recommend next action | ❌ Not built | Deterministic ranking over Measure's signal first, before any AI assist |
| 10 | Intelligent coaching | ✅ Deterministic coaching message + hint ladder | GenAI only where deterministic logic proves insufficient — see `Product-Vision.md`'s GenAI Strategy |
| 11 | Create assessments | ❌ Not built (teacher can only create a class, no question/assessment configuration) | Teacher/parent question selection + assignment, on the same engine |
| 12 | Evaluate performance | ⚠️ Per-topic accuracy/streak, class-joined student self-view only | Teacher/parent visibility into assigned-assessment results |

**Near-term** (evidence-ready, no open product-policy question):
- **Export authored misconception content to runtime** — powers Diagnose (#3) and Fix (#4) simultaneously with zero new content authoring; the content already exists (see `Product-Vision.md`). For choice questions, `commonWrongOptionId` gives an exact match; free-text questions are a smaller, harder-to-close slice.
- **A learner-facing "review what I got wrong" view** (#5) — needs per-question correctness history, which the class-joined flow already has server-side; the anonymous flow would need it added client-side or would need #13 resolved first.

**Blocked on a product-owner decision, not on evidence or engineering scope:**
- **Self-serve reach for Assess/Revise/Understand-readiness (#6, #7, #8)** — the single highest-leverage item this roadmap currently names. Requires an explicit decision on whether the product supports learners without a teacher/class relationship (a target-audience/product-policy question, not just an engineering task) before it can be scoped. See `Product-Vision.md`'s Common Product Model and its named "known current gap."

**Explicitly deferred** (see `Product-Vision.md`'s Explicit Non-Goals for the full list and rationale): a large teacher dashboard (#11/#12 at scale), a full custom-question ingestion pipeline (#11), a full competitive-exam framework, autonomous/multi-agent AI architecture, a general-purpose AI chatbot, a sophisticated adaptive-learning engine.

---

## Medium-term

Depends on data Shadow Mode is now producing, or on persistence that doesn't exist yet:

- **Confidence-gated live AI evaluation** — blocked on the confidence-calibration gap Feature 014 found (reported confidence didn't separate correct from incorrect judgments across 30 samples; both disagreements scored 0.95, same as many correct judgments).
- **Misconception-tag controlled vocabulary** — Feature 014 confirmed free-form tags come back inconsistently formatted; a fixed vocabulary must be enforced by the system, not left to the model.
- **Student Progress History** — no persistence exists today; this is also the prerequisite for Shadow Mode's comparison-data storage and for Phase 3's dashboards below.
- **Statistics Dashboard** — depends on Progress History existing first.
- **Adaptive Hint Engine**
- **Personalized hint generation**
- **AI-generated, free-text misconception-tag-informed coaching** — this is *not* the same item as the "Export authored misconception content" near-term item above. This one consumes Shadow Mode's AI-*inferred* misconception tags (free-form today, blocked on the controlled-vocabulary item directly above it) — genuinely medium-term. The near-term item consumes *human-authored* `remediationHint` content that already exists per-question and needs no AI/vocabulary work at all, only an export/pipeline change; see the North Star Capability Model section above. Do not conflate the two when scoping either.
- **Socratic hint escalation past the authored hint ladder** — `Product-Vision.md`'s GenAI Strategy use case 2. Gated on the authored hint ladder (already shipped, unchanged) having a demonstrated ceiling first.

---

## Long-term (Phase 2–5)

*Carried forward from `ProductArchitecture.md` §11, with rationale and dependencies added.*

### Phase 2 — Input Modalities
- OCR Question Scanner
- Voice Input / Voice Explanation
- Formula Revision

Rationale: removes the "must type your problem" friction. Deferred because the core coaching loop (Phase 1) needed to be trustworthy before investing in new input surfaces for it.

### Phase 3 — Oversight Surfaces
- Parent Dashboard
- Teacher Dashboard
- Analytics

Depends on: Student Progress History (medium-term, above) — there is no data to show a parent or teacher yet.

### Phase 4 — Adaptivity
- Adaptive Learning
- Personalized Practice
- Weak Topic Detection

Depends on: enough validated evaluation data (from Shadow Mode and, later, live AI evaluation) to detect patterns reliably. Building adaptivity on top of an unvalidated evaluation signal would be premature.

### Phase 5 — Distribution
- Offline Mode
- Multi-language
- Play Store Release
- Subscription Model

Rationale: distribution and monetization decisions come last, after the product is validated with real learners.

---

## Open architecture question (not decided — do not build against this)

**Content hierarchy.** Today the product implicitly assumes a single Board (CBSE), Class (8), and Subject (Math) — nothing in the code models these as data. If a second class or subject — or, per `Product-Vision.md`'s 2026-09-02 reset, a competitive-exam context — ever becomes a real requirement, a hierarchy above today's Chapter → Topic → Question (Board → Class → Subject, or an exam-track equivalent) would need its own ADR before implementation — see `ProductArchitecture.md` "Future Extensibility." This is listed here only so a future session doesn't rediscover the question from scratch; it is not scheduled to any phase above, per the "extend on evidence, not speculation" principle in `Product-Vision.md`. The 2026-09-02 reset's only change to this item: documentation must not describe "a school chapter" as a *permanent* product boundary — see `Product-Vision.md`'s "Future Extensibility to Preserve."

**Custom/teacher-authored question ingestion.** Not decided, not scheduled. A future flow (`Product-Vision.md`): *Upload → Understand → Classify → Determine answer/marking → Validate → Approve → Use*, letting a teacher/parent supply their own questions for either the shared bank or a single assessment. Listed here for the same reason as the item above — so architecture/content-pipeline work doesn't quietly assume the offline-authoring process (`ProductArchitecture.md` §14) is the only way content can ever enter the system.

**Quiz architecture — resolved, no longer open.** This entry is stale as written (it predates Test mode) and kept only so its history isn't lost: a timed/graded assessment construct **does** exist today (Test mode, Learning Session Engine Milestone C2, `ProductArchitecture.md` §18) — the "not requested, not designed" framing was true when this line was written, not now. The open question as of 2026-09-02 is not *whether* a quiz/assessment construct exists, but *who can reach it* — see this file's "North Star Capability Model" section above.

---

*Last reviewed: 2026-09-02 (Product Strategy Reset — see `Product-Vision.md`). Prior review: 2026-08-19 (M2 Documentation & Architecture Reconciliation).*
