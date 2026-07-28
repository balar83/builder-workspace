# Stage 2 — Topic Detection: Data Handling

**Input:** `raw/ncert-hemh104.json` (primary only — no supplementary source provided for this chapter).
**Constraint applied:** [`LearningExperienceArchitecture.md`](../../LearningExperienceArchitecture.md) §6 — "one Topic per existing Chapter, to start."

## Flag before proposing a structure

Unlike Linear Equations, this chapter's source material clusters into **two pedagogically distinct areas** that don't obviously belong in one "under a minute" Learn explanation (LXA §4's Learn-stage constraint):

- **Graphical data representation** — pictographs/bar graphs (recap) and pie charts (new: central-angle construction). `dh-raw-01` through `dh-raw-05`.
- **Chance and probability** — random experiments, equally likely outcomes, probability as a ratio. `dh-raw-06` through `dh-raw-09`.

These share a chapter number in the source but not a concept. Two ways to proceed:

**Option A (default — follows the accepted "one Topic per Chapter" brief literally):** one Topic, titled to span both ("Organising, Reading and Interpreting Data"), with the two areas as separate `explanation.sections[]`. Learn-stage read time will run longer than the single-concept Linear Equations Topic — acceptable only if you're fine with this Topic being an exception in length.

**Option B (deviates from the current brief):** two Topics under `data-handling` — "Pie Charts" and "Chance and Probability" — each fitting LXA's one-concept, one-minute Learn constraint cleanly. This is a one-line content-authoring policy change, not a schema or engineering change (nothing in `ProductArchitecture.md` or the app schema assumes one Topic per Chapter — that constraint lives only in `LearningExperienceArchitecture.md` §6 as a Release 0.2 starting brief, not a hard limit).

**Decided: Option A.** Confirmed by PM 2026-07-27. One Topic for this chapter, per the accepted "one Topic per Chapter to start" brief.

---

## Candidate Topic (Option A)

| Field | Value |
|---|---|
| `id` (proposed) | `topic-data-handling-representation-and-probability` |
| `chapterId` | `data-handling` |
| **Title** (proposed) | "Organising, Reading and Interpreting Data" |
| **Scope** | Reading/interpreting pictographs, bar graphs and double bar graphs (recap); constructing and reading pie charts via central-angle calculation; and the basics of chance/probability as a ratio of equally likely outcomes. |
| **Source anchors** | `dh-raw-01` through `dh-raw-09` (all of `ncert-hemh104.json`) |

### Proposed internal structure (maps to canonical `explanation.sections[]`)

1. **Reading graphs you already know** ← `dh-raw-01` (pictograph, bar graph, double bar graph — recap, not new)
2. **Pie charts: showing parts of a whole** ← `dh-raw-03` (definition, central-angle formula, two worked examples)
3. **Chance and probability** ← `dh-raw-06` (random experiments, equally likely outcomes, probability = favourable/total, events, one worked example)

### Question-shaped material available for later stages (not processed at this stage)
- `dh-raw-02`, `dh-raw-04` — pie-chart "Try These" prompts
- `dh-raw-05` (Exercise 4.1, 5 items — pie charts)
- `dh-raw-07` — probability "Try These" prompts
- `dh-raw-08` (Exercise 4.2, 6 items — probability)

---

**Review checkpoint:** confirm Option A vs. Option B before Stage 3 (Concept Extraction) proceeds. Everything below this point in the pipeline assumes Option A unless you say otherwise.
