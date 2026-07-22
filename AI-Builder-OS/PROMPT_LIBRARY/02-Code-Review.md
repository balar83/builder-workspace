# Code Review Prompt

## Objective

Review the implementation as a Principal Engineer.

The goal is to improve quality rather than simply finding faults.

Assume the feature is functionally complete.

Review for maintainability, readability, architecture, and long-term quality.

Do NOT rewrite working code unless there is clear value.

---

## Context

Project:

Feature:

Branch:

Summary:

---

## Review Areas

### 1. Requirements

Verify:

- Requirements are satisfied.
- No functionality is missing.
- No unintended functionality was introduced.

---

### 2. Architecture

Evaluate:

- Does the implementation align with the agreed architecture?
- Are responsibilities clearly separated?
- Are abstractions justified?
- Is coupling minimized?

---

### 3. Code Quality

Review:

- Naming
- Readability
- Duplication
- Complexity
- Error handling
- Type safety
- Maintainability

---

### 4. React / Frontend

If applicable review:

- Component responsibilities
- State management
- Props
- Re-render risks
- Hooks usage
- Folder organization

---

### 5. Backend

If applicable review:

- API design
- Routing
- Validation
- Error responses
- Dependency injection
- Service organization

---

### 6. Testing

Verify:

- Existing tests remain valid.
- New tests are appropriate.
- Important paths are covered.

---

### 7. Documentation

Check whether:

- Documentation reflects reality.
- Any completed work needs documenting.
- No future work is documented as completed.

---

## Findings

Categorize findings into:

### Critical

Must fix.

---

### Recommended

Should fix.

---

### Optional

Nice improvements.

---

### Positive Observations

Highlight what was done well.

---

## Final Recommendation

Choose one:

✅ Approve

⚠️ Approve with minor improvements

❌ Rework required

Explain why.
