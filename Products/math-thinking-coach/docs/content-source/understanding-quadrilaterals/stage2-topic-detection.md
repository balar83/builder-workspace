# Stage 2 — Topic Detection: Understanding Quadrilaterals

**Input:** no machine-readable source. `https://ncert.nic.in/textbook/pdf/hemh103.pdf` (NCERT Class 8 Mathematics, Chapter 3) was fetched, but the file is a scanned/image-based PDF (`JPXDecode` image streams, no extractable text layer) — attempted twice, confirmed not text-extractable by available tooling. Unlike `linear-equations` and `data-handling`, there is no `raw/` directory for this chapter: content below is authored directly from standard NCERT Class 8 Chapter 3 curriculum (definitions, formulas, and structure that are stable across NCERT editions), not extracted from a literal document scan. This is flagged honestly rather than fabricating a `raw/*.json` block-extraction file that would misrepresent its own provenance. Section numbers (3.2–3.5) cited throughout this authoring trail refer to the chapter's well-known standard structure, for traceability, not to page-level extraction.

**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start."

## Flag before proposing a structure

Like Data Handling, this chapter's material clusters into more than one pedagogically distinct area:

- **Polygon basics** — curves, simple/closed figures, convex vs. concave, regular vs. irregular. (NCERT §3.2)
- **Angle sum properties** — interior angle sum (n-2)×180°, exterior angle sum = 360°. (NCERT §3.3)
- **Kinds of quadrilaterals** — trapezium, kite. (NCERT §3.4)
- **Special parallelograms** — parallelogram, rhombus, rectangle, square, and the hierarchy among them. (NCERT §3.5)

**Decided: Option A**, consistent with the precedent set for Data Handling (Decided 2026-07-27) and the accepted "one Topic per Chapter to start" brief — one Topic, four `explanation.sections[]`, accepting a longer-than-Linear-Equations Learn read as a deliberate exception (same trade-off Data Handling already made).

---

## Candidate Topic

| Field | Value |
|---|---|
| `id` (proposed) | `topic-understanding-quadrilaterals-polygons-and-properties` |
| `chapterId` | `understanding-quadrilaterals` |
| **Title** (proposed) | "Understanding Quadrilaterals: Polygons and Their Properties" |
| **Scope** | Classifying polygons (convex/concave, regular/irregular); the interior and exterior angle sum properties; the trapezium and kite; parallelograms and their special cases (rhombus, rectangle, square) and the hierarchy among them. |
| **Source anchors** | NCERT Class 8 Ch. 3, §3.2–§3.5 (see provenance note above) |

### Proposed internal structure (maps to canonical `explanation.sections[]`)

1. **Polygons: curves, convexity and regularity** ← §3.2
2. **Angle sum property of a polygon** ← §3.3
3. **Trapezium and kite** ← §3.4
4. **Parallelograms and their special cases** ← §3.5

### Question-shaped material available for later stages (not processed at this stage)

Angle-sum computation and back-solving (find n from a given angle); property-identification and property-application questions for each named quadrilateral; hierarchy/classification reasoning questions (e.g. "is every square a rectangle?"). Full list authored at Stage 6.

---

**Review checkpoint:** this Topic follows the same Option A pattern already approved for Data Handling — no separate PM confirmation sought before Stage 3, per that established precedent.
