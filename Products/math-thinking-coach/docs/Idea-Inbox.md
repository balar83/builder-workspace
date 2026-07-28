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

---

*Started: 2026-07-23 (Product Foundation Sprint).*
