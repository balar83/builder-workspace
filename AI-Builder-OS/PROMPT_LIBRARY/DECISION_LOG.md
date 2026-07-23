# DECISION_LOG.md

# AI Builder Operating System
Version: 1.0

---

# Purpose

This document records significant engineering, architectural, and product decisions made during software development.

The goal is to capture the reasoning behind decisions so that future changes are made with context rather than assumptions.

This log complements project documentation and should reference decisions made across all products within the Builder Workspace.

---

# Guiding Principles

Record decisions that are:

- Significant
- Long-lived
- Difficult to reverse
- Likely to influence future development

Do not record trivial implementation details.

---

# Decision Categories

Examples include:

- Product Decisions
- Architecture Decisions
- Technology Choices
- Framework Selection
- API Design
- Database Design
- Repository Structure
- Documentation Standards
- Development Workflow
- AI Workflow
- Testing Strategy
- Deployment Strategy

---

# Decision Template

## ADR-XXX

### Title

Short descriptive title.

---

### Date

YYYY-MM-DD

---

### Status

Choose one:

- Proposed
- Accepted
- Superseded
- Deprecated

---

### Context

What problem or situation required a decision?

---

### Options Considered

List the realistic alternatives.

Example:

1. Option A
2. Option B
3. Option C

---

### Decision

Describe the chosen solution.

---

### Rationale

Explain why this option was selected.

Include:

- Product considerations
- Engineering considerations
- Trade-offs
- Simplicity
- Maintainability
- Learning value

---

### Consequences

Positive:

-

Negative:

-

Future Considerations:

-

---

### Related Documents

Reference relevant documentation.

Example:

- ProductArchitecture.md
- Development-Journal.md
- ENGINEERING_PRINCIPLES.md

---

# Current Decisions

This log is a cross-product index. Full ADRs are written and kept inside each product's own `docs/ADR/` folder, using `PROMPT_LIBRARY/ARCHITECTURE_DECISION_TEMPLATE.md`; entries below point to them rather than duplicating their content.

## Math Thinking Coach

- **ADR-001 — Separate Evaluation from Coaching Behind a Service-Layer Seam** (2026-07-15, Accepted). See `Products/math-thinking-coach/docs/ADR/ADR-001-evaluation-coaching-separation.md`.

The next decision should be recorded here (as a pointer) whenever a product accepts a new ADR. Examples of what belongs in this log going forward:

- Introducing a new architecture pattern
- Choosing a persistence strategy
- Introducing authentication
- Any decision that's significant, long-lived, and difficult to reverse (see Guiding Principles above)

---

# Best Practices

Keep ADRs:

- Small
- Focused
- Objective
- Immutable

Never rewrite history.

If a decision changes:

Create a new ADR referencing the previous one instead of editing the original.

---

# Long-Term Vision

Over time, this log becomes the historical record of how products evolved.

Future contributors should be able to understand not only what decisions were made, but why they were made.

---

End of Document