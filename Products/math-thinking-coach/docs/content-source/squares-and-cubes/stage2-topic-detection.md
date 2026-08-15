# Stage 2 — Topic Detection: Squares and Cubes

**Inputs (user-supplied, 2026-08-15):**
- `square_and_cube.pdf` — NCERT's current "Ganita Prakash" Class 8 textbook, Chapter 1, **"A Square and A Cube"** (Reprint 2026-27). This is the live, current-syllabus chapter and treats squares/square roots and cubes/cube roots as **one unified chapter** — confirms the milestone's chosen chapter scope is source-backed, not an invented merge.
- `squares.pdf` — prior NCERT edition, Chapter 5, "Squares and Square Roots" (Reprint 2024-25).
- `cubes.pdf` — prior NCERT edition, Chapter 6, "Cubes and Cube Roots" (Reprint 2024-25).

All three have extractable text layers (no scanned-PDF provenance issue here, unlike Understanding Quadrilaterals). The current edition (`square_and_cube.pdf`) is used as the primary structural source; the two prior-edition chapters are used to supplement with fully-worked examples and exercise-style problems, since the current edition is written in a discovery/inquiry style ("Math Talk", "Try This", "Figure it Out") with fewer complete worked solutions.

**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start." Same precedent as Data Handling and Understanding Quadrilaterals: this chapter's material spans more than one pedagogically distinct area, so it is authored as **one Topic with four `explanation.sections[]`**, not split into multiple Topics.

## Candidate Topic

| Field | Value |
|---|---|
| `id` (proposed) | `topic-squares-and-cubes-numbers-and-roots` |
| `chapterId` | `squares-and-cubes` |
| **Title** (proposed) | "A Square and A Cube: Numbers and Roots" |
| **Scope** | Perfect squares and their properties (unit-digit test, odd-number-sum test, Pythagorean triplets); finding square roots (repeated subtraction, prime factorisation, estimation); perfect cubes and their properties (prime-factorisation test, the Hardy–Ramanujan number); finding cube roots (prime factorisation). |
| **Source anchors** | NCERT Ganita Prakash Class 8 Ch.1 §1.1–1.2 (current edition); prior-edition Ch.5 §5.1–5.5 and Ch.6 §6.1–6.3 (supplementary worked examples) |

### Proposed internal structure (maps to canonical `explanation.sections[]`)

1. **Square numbers and their properties** ← Ganita Prakash §1.1 / prior Ch.5 §5.1–5.3
2. **Finding square roots** ← Ganita Prakash §1.1 (Square Roots) / prior Ch.5 §5.4–5.5
3. **Cube numbers and their properties** ← Ganita Prakash §1.2 / prior Ch.6 §6.2
4. **Finding cube roots** ← Ganita Prakash §1.2 (Cube Roots) / prior Ch.6 §6.3

### Question-shaped material available for later stages (not processed at this stage)

Perfect-square/perfect-cube identification (unit-digit test, prime-factorisation test); smallest multiplier/divisor to complete a pair or triple; Pythagorean triplet construction; square-root/cube-root by prime factorisation and by repeated subtraction; square-root estimation between consecutive whole numbers; real-world area→side and volume→edge problems; the Hardy–Ramanujan number (1729) as a concrete numeric computation. Full list authored at Stage 6.

**Note on originality**: explanation prose and all questions are written in this project's own voice, using the source PDFs for concepts, structure, and problem *types* only — not reproduced verbatim from NCERT text, consistent with how every other chapter in this repo has been authored.

**Review checkpoint:** follows the same Option A pattern (one Topic, multiple sections) already approved for Data Handling and Understanding Quadrilaterals — no separate PM confirmation sought before Stage 3, per that established precedent.
