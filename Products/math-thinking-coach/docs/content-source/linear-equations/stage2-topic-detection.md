# Stage 2 — Topic Detection: Linear Equations

**Input:** `raw/ncert-hemh102.json` (primary), `raw/worksheet-wa0007.json` (supplementary, question-shaped only).
**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start" (Release 0.2 accepted brief). This is not a Stage-2 judgment call; it's an existing architectural decision, so this chapter is scoped to **one candidate Topic**, not clustered into several.

**Note on the worksheet source:** `worksheet-wa0007.json`'s 6 questions are verbatim duplicates of Exercise 2.1, items 1–6 (`le-raw-03`) in the NCERT source. It contributes no new question material for this chapter — flagging now so it isn't double-counted at Stage 6 (Question Generation).

---

## Candidate Topic

| Field | Value |
|---|---|
| `id` (proposed) | `topic-linear-equations-one-variable` |
| `chapterId` | `linear-equations` |
| **Title** (proposed) | "Solving Linear Equations in One Variable" |
| **Scope** | Everything in the source chapter: what a linear equation is, solving equations with the variable on both sides via transposition, and reducing equations with fractional/bracketed terms to simpler linear form before solving. Excludes word-problem applications (e.g. ages, perimeters) — the source chapter's own summary point 6 mentions these as an application class, but no worked examples or exercises for them exist in this (rationalized) chapter text, so nothing to extract. |
| **Source anchors** | `le-raw-01` through `le-raw-06` (all of `ncert-hemh102.json`) |
| **Not in scope for this Topic** | Nothing excluded from the primary source — the whole chapter is thin enough (6 pages, 2 sub-sections) to fit one Topic without loss of coherence. |

### Proposed internal structure (maps to canonical `explanation.sections[]`, §2 of the design doc)

1. **What is a linear equation?** ← `le-raw-01` (expression vs. equation, LHS/RHS, linear vs. non-linear, solution, balancing method)
2. **Solving when the variable is on both sides** ← `le-raw-02` (transposition method, Examples 1–2)
3. **Reducing equations to simpler form** ← `le-raw-04` (clearing denominators via LCM, opening brackets, Examples 16–17)

### Question-shaped material available for later stages (not processed at this stage)
- `le-raw-03` (Exercise 2.1, 10 items) — matches structure 1–2 above
- `le-raw-05` (Exercise 2.2, 10 items) — matches structure 2–3 above
- `le-raw-ws-01` (worksheet, 6 items) — duplicate of Exercise 2.1 items 1–6, see note above

---

**Review checkpoint:** confirm the single-Topic scoping and the proposed title/section breakdown before Stage 3 (Concept Extraction) proceeds against this structure.
