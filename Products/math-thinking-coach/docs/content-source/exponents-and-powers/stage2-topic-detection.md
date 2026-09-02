# Stage 2 — Topic Detection: Exponents and Powers

**Input (user-supplied, 2026-09-02):** `exponents.pdf` — NCERT Class 8 Mathematics, Chapter 10, "Exponents and Powers" (Reprint 2024-25). Extractable text layer, single source document covering: powers with negative exponents, the five laws of exponents extended from positive to all integer exponents, and using exponents to express and compare very small numbers in standard form.

**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start." Same precedent as every other chapter in this repo (Data Handling, Understanding Quadrilaterals, Squares and Cubes, etc.): authored as **one Topic with four `explanation.sections[]`**, not split into multiple Topics.

## Candidate Topic

| Field | Value |
|---|---|
| `id` (proposed) | `topic-exponents-and-powers-laws-and-standard-form` |
| `chapterId` | `exponents-and-powers` |
| **Title** (proposed) | "Exponents and Powers: Laws, Negative Exponents and Standard Form" |
| **Scope** | Powers with negative integer exponents and multiplicative inverses (§10.2); the five laws of exponents (product, quotient, power-of-a-power, product/quotient of same-exponent different bases, zero exponent) verified to hold for negative and zero integer exponents, and solving for an unknown exponent (§10.3); expressing very small decimal numbers in standard form and reversing the conversion (§10.4); comparing and combining (adding/subtracting) very large and very small numbers given in standard form (§10.4.1). |
| **Source anchors** | NCERT Class 8 Ch.10 §10.1–10.4.1 (single edition, Reprint 2024-25) |

### Proposed internal structure (maps to canonical `explanation.sections[]`)

1. **Powers with negative exponents** ← §10.1–10.2
2. **Laws of exponents** ← §10.3
3. **Standard form for very small numbers** ← §10.4
4. **Comparing and combining very large and very small numbers** ← §10.4.1

### Question-shaped material available for later stages (not processed at this stage)

Evaluating negative-exponent powers (integer and fractional bases); finding multiplicative inverses; expanded form of a decimal using positive and negative powers of 10; applying each of the five laws individually and in combination (mixed multi-step simplification); solving for an unknown exponent given an equation of equal-base powers; converting very small decimals to/from standard form; comparing magnitudes via ratio of standard-form numbers; adding/subtracting numbers given in standard form by aligning exponents first. Full list authored at Stage 6.

**Note on originality**: explanation prose and all questions are written in this project's own voice, using the source PDF for concepts, structure, and problem *types* only — numeric examples are original variations, not reproduced verbatim from NCERT text or its worked examples, consistent with how every other chapter in this repo has been authored. Two real-world facts (the charge of an electron, ≈1.6×10⁻¹⁹ coulomb, and the definition of a micron) are kept as-is since they are factual constants, not authored solutions — same precedent as reusing the Hardy–Ramanujan number (1729) verbatim in Squares and Cubes.

**Review checkpoint:** follows the same Option A pattern (one Topic, multiple sections) already approved for every existing chapter — no separate PM confirmation sought before Stage 3, per that established precedent. Authored as part of the Content Expansion for Exam Practice milestone (2026-09-02), ~3 weeks before the target exams.
