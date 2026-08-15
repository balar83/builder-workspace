# Stage 2 — Topic Detection: Rational Numbers (expansion)

**Input:** `rational_numbers.pdf` (user-supplied, 2026-08-15), a prior-edition NCERT Class 8 Chapter 1, "Rational Numbers" (Reprint 2024-25). The extractable text covers the introduction, and closure/commutativity/associativity/distributivity/additive-and-multiplicative-identity in full (§1.1–§1.2.6, `EXERCISE 1.1`, and the chapter summary). The chapter summary's final point ("between any two given rational numbers there are countless rational numbers... the idea of mean helps") references content — negative/reciprocal (additive and multiplicative inverse) and representation on the number line / finding rationals between two rationals — whose body text is **not present** in this particular PDF (it appears to be an abridged extract that stops after distributivity, skipping ahead to the summary). Sections 4 and 5 below are therefore authored from standard NCERT Class 8 Ch.1 curriculum knowledge, same honest-provenance approach already used for Understanding Quadrilaterals when its source PDF wasn't usable — flagged here rather than silently presented as extracted.

**Existing runtime state**: `rational-numbers` already has a chapter entry and a minimal, non-pipeline-authored Topic (`topic-rational-numbers-basics` — 1 short paragraph, 3 objectives, no `content-source` trail, no `reviewStatus`). This Stage 10 export will **replace** that Topic and its question bank in full (`mergeAndWrite`'s per-chapterId partition replace, same mechanism that replaced Understanding Quadrilaterals' 5 hand-seeded placeholders).

**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start." This chapter's material spans five pedagogically distinct areas, more than the other chapters — authored as **one Topic with five `explanation.sections[]`** rather than split into multiple Topics, consistent with the established pattern.

## Candidate Topic

| Field | Value |
|---|---|
| `id` (proposed) | `topic-rational-numbers-properties-and-operations` |
| `chapterId` | `rational-numbers` |
| **Title** (proposed) | "Rational Numbers: Properties and Operations" |
| **Scope** | What a rational number is and its standard form; closure, commutativity and associativity across whole numbers, integers and rational numbers; distributivity and the identity elements (0 and 1); additive inverse and multiplicative inverse (reciprocal); representing rational numbers on the number line and finding a rational number between two given rational numbers. |
| **Source anchors** | NCERT Class 8 Ch.1 §1.1–1.2.6 (extracted); §1.2.7 (reciprocal), §1.3, §1.4 (domain knowledge, not extracted — see provenance note above) |

### Proposed internal structure (maps to canonical `explanation.sections[]`)

1. **What is a rational number?** ← §1.1 (extracted) + standard-form convention (domain knowledge)
2. **Closure, commutativity and associativity** ← §1.2.1–1.2.3 (extracted)
3. **Distributivity and the identity elements** ← §1.2.4–1.2.6 (extracted)
4. **Negative and reciprocal** ← domain knowledge (not extracted from this PDF)
5. **The number line and rational numbers between two rationals** ← domain knowledge (not extracted from this PDF; chapter summary references this content but body text absent)

### Question-shaped material available for later stages (not processed at this stage)

Identifying rational numbers and reducing to standard form; closure/commutativity/associativity true-or-false and property-naming questions; direct computation using distributivity; additive inverse and reciprocal computation, including the "0 has no reciprocal" edge case; finding a rational number between two given rationals via the mean method. Full list authored at Stage 6.

**Note on originality**: explanation prose and all questions are written in this project's own voice — not reproduced verbatim from NCERT text.

**Review checkpoint:** follows the same Option A pattern already approved for Data Handling, Understanding Quadrilaterals and Squares and Cubes — no separate PM confirmation sought before Stage 3.
