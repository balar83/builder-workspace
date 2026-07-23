# Claude Code Implementation Prompt Template

## Pre-Implementation

Before making any code changes:

1. Read and follow the repository's `CLAUDE.md`.
2. Review the existing implementation relevant to this feature.
3. Understand the current architecture before making changes.
4. Implement only the agreed scope.
5. Prefer the simplest maintainable solution.
6. Avoid unnecessary abstractions or overengineering.
7. Update only documentation directly impacted by this feature.
8. Verify:
   - Build passes
   - Lint passes
   - Tests pass

---

## Planning

Before coding:

1. Summarize your implementation plan in 5–10 bullet points.
2. Identify any architectural concerns or requirement conflicts.
3. If a conflict materially changes the agreed design, stop and ask for clarification.
4. Otherwise proceed with implementation.

---

## Feature

**Feature Name**

<Replace>

### Objective

<Replace>

### Requirements

<Replace>

---

## Implementation Guidelines

- Keep business logic inside services.
- Keep routes/components lightweight.
- Reuse existing patterns where appropriate.
- Maintain backward compatibility unless explicitly requested.
- Prefer strongly typed models and enums over free-form strings.
- Keep implementation incremental and reviewable.

---

## Acceptance Criteria

<Replace>

---

## Verification

Confirm:

- Backend starts successfully (if applicable)
- Frontend builds successfully (if applicable)
- Tests pass
- Existing functionality remains unchanged
- New functionality behaves as expected

---

## Deliverables

Provide:

- Files created
- Files modified
- Architectural decisions
- Assumptions made
- Future extension points
- Documentation updated
