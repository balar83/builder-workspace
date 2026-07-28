# Roadmap
**Project:** Math Thinking Coach
**Status:** Living document — capability themes and rough sequencing, not a commitment ledger. Updated as priorities change.

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

**Now active, in parallel — neither blocking the other:** Shadow Mode continues accumulating real evaluations past Feature 014's 30-sample baseline (unchanged); exporting Data Handling's already-authored 42 questions is the nearest next content step. See `Backlog.md`'s "Recommended Next."

---

## Scalable Assessment System (new milestone, sequenced 2026-07-28)

Design-reviewed before any code, per the project's workflow. Two decisions shaped the sequencing: (1) `Product-Vision.md`'s Coaching vs. Assessment Philosophy is preserved — assessments/marks are a **teacher-facing surface**, the student coaching experience stays formative and unscored, not a product pivot; (2) auth was identified as an invisible prerequisite for attempt history, adaptive selection, and teacher features alike, and pulled out as its own milestone rather than assumed away.

- **Milestone A — Student/Teacher Identity — ✓ Implemented (2026-07-28).** Minimal auth: teacher accounts, class join codes, student identity with no email/PII collected from minors. Shipped dormant — see [ADR-004](ADR/ADR-004-student-teacher-identity.md) and `Development-Journal.md`'s 2026-07-28 entry.
- **Milestone B — Server-side attempt history — ✓ Implemented (2026-07-28).** SQLite-backed attempt log + deterministic per-topic accuracy/streak/mastery aggregates, resolving the persistence question Milestone A deferred. Session-gated for logged-in students only; makes Milestone A non-dormant. See [ADR-005](ADR/ADR-005-server-side-attempt-history.md).
- **Milestone C/D — Question Selection Engine (Question Repository at scale + deterministic adaptive selection), combined.** Not started. Reads real data from Milestone B; selects from canonical + template-generated content (extends ADR-003 rather than replacing it) with an explicit future slot for AI-generated content. Deterministic difficulty/weak-concept adaptation only — no ML, consistent with this project's "extend on evidence, not speculation" principle. Design sketched in the 2026-07-28 P1–P4 design review; needs its own implementation-ready pass before code, same as B got.
- **Milestone E — Assessment Engine, teacher-facing surface with a student-facing opt-in Test mode.** Marks, patterns, configurable tests (practice/test/revision). Resolved against `Product-Vision.md`'s Coaching vs. Assessment Philosophy during the 2026-07-28 design review: default coaching stays score-free; Test mode is a distinct, explicitly-opted-into surface with a self-feedback summary. Question types phased — MCQ/True-False/Fill-in-blank/Match-the-following/Short-Answer first (rule-based); Long Answer/Multi-step Solve/Higher-order-thinking deferred until Shadow Mode's confidence-calibration gap (Feature 014) closes, since those types need live AI evaluation to grade reliably. Also surfaces a real gap: today's `GET /chapters/{id}/questions` returns the entire chapter to the client — "never expose the complete question bank" needs a session-scoped, one-question-at-a-time serving model, scoped as its own piece of this milestone.
- **Milestone F — Professional UI/UX redesign.** Started (2026-07-28) with a concrete, measured finding: the Question page's per-question progress-dot grid scales linearly and was verified to consume 286px of a 375px-wide mobile viewport at Linear Equations' current 44-question count. Proposal: single progress bar, true progressive disclosure of hints/solution, one primary action at a time. Not yet implemented.

None of C–F are implemented yet — each needs its own implementation-ready design pass before code, per this project's workflow (the same pattern A and B both went through).

---

## Medium-term

Depends on data Shadow Mode is now producing, or on persistence that doesn't exist yet:

- **Confidence-gated live AI evaluation** — blocked on the confidence-calibration gap Feature 014 found (reported confidence didn't separate correct from incorrect judgments across 30 samples; both disagreements scored 0.95, same as many correct judgments).
- **Misconception-tag controlled vocabulary** — Feature 014 confirmed free-form tags come back inconsistently formatted; a fixed vocabulary must be enforced by the system, not left to the model.
- **Student Progress History** — no persistence exists today; this is also the prerequisite for Shadow Mode's comparison-data storage and for Phase 3's dashboards below.
- **Statistics Dashboard** — depends on Progress History existing first.
- **Adaptive Hint Engine**
- **Personalized hint generation**
- **Misconception-informed coaching content** — depends on the controlled-vocabulary item above.

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

**Content hierarchy.** Today the product implicitly assumes a single Board (CBSE), Class (8), and Subject (Math) — nothing in the code models these as data. If a second class or subject ever becomes a real requirement, a Board → Class → Subject → Chapter → Topic → Question hierarchy would need its own ADR before implementation — see `ProductArchitecture.md` "Future Extensibility." This is listed here only so a future session doesn't rediscover the question from scratch; it is not scheduled to any phase above, per the "extend on evidence, not speculation" principle in `Product-Vision.md`.

**Quiz architecture.** No timed/graded assessment construct exists or has been requested — the current flow is a linear, self-paced sequence of questions. Not designed, not scheduled. Noted here so it isn't silently invented later.

---

*Last reviewed: 2026-07-23 (Product Foundation Sprint).*
