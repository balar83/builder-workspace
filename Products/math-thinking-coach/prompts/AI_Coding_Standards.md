# AI Coding Standards v1.0

## Purpose

This document defines the engineering standards that every AI coding assistant must follow while working on the Math Thinking Coach project.

These rules are mandatory.

---

# 1. Architecture

Always follow the existing project architecture.

Do not create new top-level folders.

Use only the existing folder structure.

If a new folder appears necessary, ask for approval before creating it.

Never move existing files unless explicitly instructed.

Prefer the simplest architecture that satisfies current requirements. Do not introduce additional abstraction until there is a demonstrated need.

---

# 2. Project Structure

frontend/
    src/
        app/
        assets/
        components/
        features/
            chapters/
            questions/
            hints/
            solutions/
            history/
        hooks/
        pages/
        services/
        types/
        utils/

    tests/
        components/
        pages/
        features/

backend/
    app/

docs/

prompts/

---

# 3. Coding Standards

Use:

- React
- TypeScript
- Functional Components
- Hooks

Avoid:

- Class Components
- Inline business logic
- Duplicate code
- Large components

Prefer reusable components.

---

# 4. Naming

Components

ChapterCard.tsx

QuestionCard.tsx

Pages

HomePage.tsx

QuestionPage.tsx

Types

Question.ts

Chapter.ts

Data

chapters.ts

questions.ts

---

# 5. File Placement

Pages

src/pages

Reusable UI

src/components

Business Logic

src/features

Shared Types

src/types

Utility Functions

src/utils

API

src/services

Tests

frontend/tests

Never create another tests folder.

---

# 6. Testing

Use Vitest.

Place tests inside

frontend/tests

Mirror the source folder structure.

Example

tests/components/ChapterCard.test.tsx

tests/pages/QuestionPage.test.tsx

Generate tests only for:

- reusable components
- utility functions
- business logic

Do not generate unnecessary tests.

---

# 7. Styling

Use existing styling approach.

Keep UI

- clean
- responsive
- mobile first

Avoid inline styles.

---

# 8. Routing

Use React Router.

Do not change existing routes.

Only add routes required for the feature.

---

# 9. State Management

Keep state local whenever possible.

Do not introduce Redux, Zustand or other state libraries without approval.

---

# 10. Dependencies

Before adding any dependency:

Explain

- why it is needed
- alternatives
- impact

Then wait for approval.

Never install packages automatically.

---

# 11. Permissions

Allowed

✅ Create files inside existing folders

✅ Update package.json after approval

✅ Add routes

✅ Create reusable components

✅ Create tests

✅ Refactor code inside a feature

Not Allowed

❌ Create top-level folders

❌ Rename project structure

❌ Introduce new architecture

❌ Delete existing files

❌ Move files between folders

❌ Install dependencies without approval

❌ Change coding style

---

# 12. AI Output

After every implementation provide:

## Files Created

...

## Files Modified

...

## Decisions Made

...

## Assumptions

...

## Risks

...

## Next Recommended Step

...

---

# 13. Review Checklist

Before considering the task complete verify:

- Project builds
- No TypeScript errors
- No lint issues
- No broken routes
- No duplicate code
- Components are reusable
- Folder structure preserved

---

# 14. Guiding Principle

The AI is an implementation partner.

It must not make architectural decisions.

Architecture decisions belong to the Product Architect.

---

# 15. Definition of Done (DoD)

A feature is considered complete only when ALL the following conditions are satisfied.

## Functional

- The feature meets all acceptance criteria.
- The feature works as expected.
- Existing functionality is not broken.

---

## Code Quality

- Project builds successfully.
- No TypeScript errors.
- No lint errors.
- No unnecessary warnings.
- No duplicated code.
- No commented-out code.
- No unused imports.
- No unused variables.

---

## Architecture

- Existing folder structure is preserved.
- Existing architecture is followed.
- Components are reusable.
- Business logic is separated from UI.
- Types are strongly defined.
- No hardcoded values where reusable configuration is appropriate.

---

## Testing

Where applicable:

- Unit tests are added.
- Existing tests pass.
- New functionality is covered.

---

## User Experience

- Mobile responsive.
- Consistent UI.
- Proper loading states (when applicable).
- Proper error handling (when applicable).
- Accessibility considered for interactive elements.

---

## Documentation

The AI must provide:

### Files Created

...

### Files Modified

...

### Dependencies Added

...

### Decisions Made

...

### Assumptions

...

### Risks

...

### Future Improvements

...

---

## Final Verification Checklist

Before marking the task complete, verify:

- [ ] Application starts successfully.
- [ ] Build succeeds.
- [ ] Lint passes.
- [ ] TypeScript passes.
- [ ] Tests pass (if applicable).
- [ ] Routing works.
- [ ] Feature works as expected.
- [ ] Documentation updated if required.

Only after every item is satisfied should the feature be considered complete.

------------------------
# 16. AI Decision Framework

This tells the AI how to think before coding.

For every implementation, the AI should follow this order:

Understand the user problem – never implement blindly.

Reuse existing code – search before creating.

Keep it simple – avoid unnecessary complexity.

Optimize for maintainability – readability over cleverness.

Optimize for cost – avoid unnecessary libraries, API calls, and token usage.

Explain trade-offs – if there are multiple approaches, briefly state why one was chosen.

Escalate architectural changes – don't make them without approval.