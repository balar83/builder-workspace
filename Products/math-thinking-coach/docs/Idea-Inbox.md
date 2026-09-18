# Idea Inbox
**Project:** Math Thinking Coach

---

## Purpose

Append-only. Every idea that occurs to anyone working on this product goes here immediately, exactly as raised, with a date. No filtering, no prioritization, no judgment about whether it's good — that happens later, when this file is reviewed.

This document is intentionally exempt from `AI-Builder-OS/CLAUDE.md`'s "documentation reflects only completed reality" rule.

---

## Rules

1. **Append only.** Never delete or edit a past entry. If an idea is later rejected or superseded, add a new dated line noting the outcome — don't erase the original.
2. **No prioritization here.** Prioritization happens in [`Roadmap.md`](Roadmap.md) (thematic sequencing) or [`Backlog.md`](Backlog.md) (approved, scoped work).
3. **One idea per entry, dated.**

---

## How ideas flow out of this file

1. Idea lands here, raw, dated.
2. Periodically reviewed — at a documentation audit or milestone boundary, per `AI-Builder-OS/DOCUMENTATION_STANDARDS.md`.
3. On review, each idea goes one of four ways:
   - **Discarded** — noted inline as such; the original entry stays (history, not deleted).
   - **→ `Roadmap.md`** — if it's a real capability theme worth sequencing.
   - **→ `Backlog.md`** — if it's specific and approved enough to scope directly.
   - **→ `Learning/4_Idea_Parking_Lot.md`** (workspace-level) — if it's a builder-capability idea rather than a feature for this product.

---

## Entries

### 2026-07-23 — Product Foundation Sprint

- **Board → Class → Subject → Chapter → Topic content hierarchy**, raised as a candidate ADR-001 during this sprint. Not decided, nothing built against it. Reviewed same day → routed to `Roadmap.md`'s "Open architecture question" (not `Backlog.md` — there is nothing yet to scope).
- **Formal "Quiz" architecture** (a timed/graded assessment construct, distinct from the current linear, self-paced question flow) — no product requirement identified during this review. Reviewed same day → left here, not promoted anywhere.
- **Items carried forward from `Backlog.md`'s former "Future (unscoped / unprioritized)" section**, moved here because `Backlog.md` is defined as approved work only and these were never approved (original raise dates predate this file and aren't recoverable): personalized hint generation; misconception-informed coaching content; adaptive hint engine; student progress history; statistics dashboard; teacher portal. Reviewed same day → all six promoted to `Roadmap.md`'s medium/long-term themes.

### 2026-07-28 — Scalable Assessment System design review

- Revisits the 2026-07-23 "Formal 'Quiz' architecture" entry above: a real product requirement now exists (user-requested "scalable assessment system" milestone). Design-reviewed against `Product-Vision.md`'s Coaching vs. Assessment Philosophy before any code — resolved as a **teacher-facing** assessment surface (marks, configurable tests, administered by a teacher), not a change to the student coaching experience, which stays formative and unscored. Routed to `Roadmap.md`'s new "Scalable Assessment System" section as Milestones A–F; Milestone A (identity) implemented same day, see [ADR-004](ADR/ADR-004-student-teacher-identity.md).
- **Superseded 2026-09-02**, per the entry below: the "assessment is teacher-facing" resolution above is retired as forward-looking product framing (kept as accurate history of what was decided on 2026-07-28, not as current guidance) — see `Product-Vision.md`'s "Assessment Is Not Inherently Teacher-Only."

### 2026-09-02 — Product Strategy Documentation Alignment

Not a new idea raised in isolation — a full strategic reset agreed with the user, requiring a fresh North Star, then routed across the documentation set per this file's own "graduates elsewhere on review" convention (step 2 above), same day:

- **North Star reframing** (an intelligent learning-and-assessment platform on one common engine, serving self-directed/teacher-parent/institutional contexts alike, not an anonymous-only app or a teacher-only product) → `Product-Vision.md` (rewritten), `LearningExperienceArchitecture.md` (rewritten), `Roadmap.md`/`ProductArchitecture.md`/`README.md`/`Phase-1-Handoff.md`/`PROJECT_STATUS.md`/`Backlog.md` (updated as current-state pointers).
- **North Star learner journey** (Understand → Practise → Diagnose → Fix → Review → Reattempt → Test → Measure → Recommend → Improve) → `LearningExperienceArchitecture.md` §2, with a new §2a mapping every already-shipped feature onto it and naming Diagnose/Fix/Reattempt/Recommend as wholly unbuilt.
- **Common product model** (Learner→Content→Attempt→Evidence→Intervention→Assessment→Result, one engine not two) → `Product-Vision.md`'s new "Common Product Model" section; the concrete current-vs-target architecture gap → `ProductArchitecture.md` §1a (new).
- **Assessment not inherently teacher-only** → `Product-Vision.md` (new section, retires the 2026-07-28 entry above's framing).
- **12-capability model, current vs. target** → `Roadmap.md`'s new "North Star Capability Model" section; `Product-Vision.md`'s "Current State vs. Target State" table.
- **Mastery/Fluency/Transfer/Readiness + the "twist"/transfer cognitive-demand taxonomy** → `Product-Vision.md` (new section, explicitly future-direction-only, not implemented) and `LearningExperienceArchitecture.md` §3/§4.
- **GenAI strategy** (deterministic-first; 5 named future use cases — AI fallback remediation, Socratic hint escalation, AI study recap, AI-supported next-step recommendations, AI-assisted question selection/generation; explicit non-goals of a general chatbot/broad tutoring/autonomous or multi-agent architectures) → `Product-Vision.md`'s new "GenAI Strategy" section; `LearningExperienceArchitecture.md` §5 (AI Contribution Map, restructured).
- **Existing authored remediation** (`commonWrongAnswer`/`why`/`remediationHint`/`commonWrongOptionId`, already authored but not exported to runtime) → `Product-Vision.md`'s "Existing authored remediation" sub-section, `ProductArchitecture.md` §7, flagged in `Roadmap.md`'s capability model as the single highest-leverage near-term item.
- **Teacher/parent custom-question future flow** (Upload → Understand → Classify → Determine answer/marking → Validate → Approve → Use) → `Product-Vision.md`'s "Future Extensibility to Preserve"; preserved (not scheduled) in `ProductArchitecture.md` §7's extensibility note and `Roadmap.md`'s "Open architecture question."
- **Competitive-exam expansion** (preserve flexibility, don't design around it now) → same two locations as above.
- **9 explicit current non-goals** (autonomous AI agents, general AI chatbot, sophisticated adaptive-learning engine, complex mastery algorithms, full competitive-exam framework, large teacher dashboard, full parent portal, large-scale AI-generated question bank, full custom-question ingestion pipeline) → `Product-Vision.md`'s "Explicit Non-Goals" section.
- **Documentation cleanup, not a new idea but part of this pass**: while reconciling docs against actual repo state, found that Slice A2/A2b (structured Topic content migration, commits `51a05fe`/`d7890cc`) had shipped without ever being documented as complete — several files (`Phase-1-Handoff.md`, `PROJECT_STATUS.md`, `Backlog.md`, `ProductArchitecture.md`) still described them as "not started." Corrected in place rather than left standing, per this project's documentation-quality convention. Also corrected a separate stale claim in `ProductArchitecture.md` (a "no Quiz construct exists" line that predated Test mode).

No item above is scheduled or authorized to start beyond what was already shipped before this pass. This entry exists so a future review of this file can trace which future-facing ideas already graduated into living documents on 2026-09-02, rather than re-raising them as if new.

---

*Started: 2026-07-23 (Product Foundation Sprint).*
