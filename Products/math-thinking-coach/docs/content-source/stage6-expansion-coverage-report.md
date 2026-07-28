# Stage 6 Expansion — Coverage & Self-Review Report

Covers the expansion pass approved after the initial Stage 6 review: Linear Equations grew from 22 → **44** questions, Data Handling from 13 → **42** questions (35–40 was the target; landed 2 over to give objectives 2 and 5 a second question each rather than leave a coverage gap for the sake of a round number).

---

## 1. Self-review

**Mathematical correctness.** Every question's `expectedAnswer` includes the worked check (substitution back into the original LHS/RHS, or a proportion/sum check for Data Handling), not just a bare final value — the same convention used since the original Stage 6 pass. Every new equation and word problem was solved independently by hand as part of authoring (shown inline in `expectedAnswer`), not generated and left unverified. The trickiest ones — fraction+bracket combinations (`le-q35`, `le-q36`) and multi-step percentage back-solving (`dh-q24`, `dh-q36`, `dh-q39`) — were double-checked against their own stated answer during this review pass.

**Duplicates.** Ran an automated check across both files for exact-duplicate `prompt` text and exact-duplicate `expectedAnswer` text: **zero duplicates found** in either file. Beyond the automated check: no two questions share the same equation/coefficients or the same word-problem scenario, by construction — every new item used original numbers chosen specifically to avoid overlapping the NCERT-sourced items or each other. Note: a few different questions coincidentally resolve to the same final number (e.g. `le-q31` and `le-q38` both solve to 6) — this isn't a flagged duplicate, since the questions test different skills/contexts and a shared small-integer answer across dozens of items is expected, not a sign of redundant content.

**Difficulty balance.**
| Chapter | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| Linear Equations | 14 (32%) | 16 (36%) | 14 (32%) | 44 |
| Data Handling | 25 (60%) | 10 (24%) | 7 (16%) | 42 |

Linear Equations landed close to an even three-way split. Data Handling stayed easy-skewed even after the expansion — flagging this honestly rather than forcing artificial difficulty: objectives 1, 2, 3, 7, 8, 9 (reading graphs, why order doesn't matter, what a sector represents, random vs. predictable, listing outcomes, equally-likely reasoning) are foundational recall/comprehension checks by nature at first introduction, and manufacturing "hard" versions of "what does a pie sector represent?" would be artificial rather than pedagogically meaningful. The Hard tier is concentrated in objective 6 (percentage back-solving) and objective 10 (probability word problems), where genuine multi-step difficulty exists. If you want a stronger Medium/Hard push, the honest way to get it is more back-solving/probability-algebra items (objectives 6, 10), not harder versions of the recall objectives.

**Bloom level distribution.**
| Chapter | recall | application | analysis |
|---|---|---|---|
| Linear Equations | 7 (16%) | 31 (70%) | 6 (14%) |
| Data Handling | 16 (38%) | 17 (40%) | 9 (21%) |

**Progression easy → challenging.** Both files order roughly by increasing structural complexity within each objective group (single-transposition → bracket expansion → LCM/fractions → decimals/combined, and reading → central-angle → back-solving → probability-algebra for Data Handling), so a student working through a Topic's question pool in file order encounters increasing difficulty rather than a random mix. The `difficulty` field is still the authoritative signal for any actual sequencing logic in the app — file order is a authoring convenience, not something the app should rely on positionally.

---

## 2. Learning objective → question IDs

### Linear Equations (`stage4-learning-objectives.md`, 8 objectives)
| # | Objective | Question IDs | Count |
|---|---|---|---|
| 1 | Distinguish expression vs. equation | le-q21, le-q23, le-q24 | 3 |
| 2 | Identify a linear expression | le-q21, le-q24 | 2 |
| 3 | Identify LHS/RHS | le-q22, le-q25, le-q26 | 3 |
| 4 | Verify a value is a solution | le-q27, le-q28, le-q29, le-q30 | 4 |
| 5 | Solve with variable on both sides (transposition) | le-q01–q05, le-q10, le-q31, le-q32, le-q37, le-q38 | 10 |
| 6 | Solve with a fractional coefficient | le-q07, le-q08, le-q09, le-q33, le-q43 | 5 |
| 7 | Reduce brackets/denominators to simpler form | le-q06, le-q11–q20, le-q34, le-q35, le-q36, le-q39–q42, le-q44 | 20 |
| 8 | Check by substitution | **all 44** — every `expectedAnswer` includes an explicit LHS/RHS check | 44 |

(Verified against the `objective` field actually stored in `linear-equations/stage6-questions.json` via script, not hand-recounted, after an earlier draft of this table mis-slotted le-q09.)

### Data Handling (`stage4-learning-objectives.md`, 11 objectives)
| # | Objective | Question IDs | Count |
|---|---|---|---|
| 1 | Read pictograph/bar/double-bar graph | dh-q14, dh-q15, dh-q16, dh-q17 | 4 |
| 2 | Explain why bar order doesn't change info | dh-q18, dh-q41 | 2 |
| 3 | Explain what a pie sector represents | dh-q19, dh-q20, dh-q38 | 3 |
| 4 | Calculate central angle | dh-q01, dh-q02, dh-q03 | 3 |
| 5 | Construct a pie chart (protractor) | dh-q21, dh-q42 | 2 |
| 6 | Back-solve from one known sector | dh-q22, dh-q23, dh-q24, dh-q36, dh-q38, dh-q39 | 6 |
| 7 | Distinguish random vs. predictable | dh-q25, dh-q26 | 2 |
| 8 | Identify outcomes of an experiment | dh-q04, dh-q29, dh-q30 | 3 |
| 9 | Identify equally likely outcomes | dh-q27, dh-q28, dh-q40 | 3 |
| 10 | Calculate probability | dh-q05–dh-q12, dh-q31–dh-q34, dh-q37 | 13 |
| 11 | Name a real-life probability application | dh-q13, dh-q35 | 2 |

(dh-q38 is tagged with both objectives 3 and 6 in the JSON — it genuinely tests both "what a sector represents" and "back-solving from a known sector" at once, so it's correctly listed under both. Verified against the `objective` field in `data-handling/stage6-questions.json` via script.)

Every objective in both chapters now has **at least 2 questions** — the one hard requirement from your review.

---

## 3. Misconception coverage

Every question is authored around exactly one target misconception (`misconception.commonWrongAnswer/why/remediationHint` in the JSON) — so by construction, all 86 misconceptions across both files (44 + 42) are each "challenged" by the question they were written for. Rather than list all 86 1:1 pairs here (already fully traceable in the JSON via `id` → `misconception`), grouped by theme:

**Linear Equations** — sign errors on transposition (le-q01,02,03,05,10,17,20,29,31,32), bracket-expansion errors (le-q06,07,15,18,19,30,34,35,36), LCM/fraction-clearing errors (le-q08,09,11,12,13,16,33,43), definitional confusion (le-q21,23,24,25,26), translation-of-word-problem errors (le-q26,37,38,39,40,41,42,44), and trust-without-verifying errors (le-q27,28,29,30).

**Data Handling** — angle/percentage conversion errors (dh-q01,02,03,22,23,24,36,38,39), definitional confusion — prime numbers, strict inequalities, "not X" (dh-q05,06,09,10,12), denominator/total-count errors (dh-q07,08,31,32,33,37), equally-likely reasoning errors (dh-q27,28,40), and reading/comprehension slips (dh-q04,14,15,16,17,18,19,20,25,26,29,30,41,42).

---

## 4. Not done in this pass

- `bloomLevel` was added to every question in both files (originals retrofitted, new ones tagged from the start) — no gaps.
- The 5 image-dependent source items (Ex 4.1 Q1/Q4, Ex 4.2 Q1a/Q3a/Q3c) are still excluded, unchanged from the original Stage 6 note — no new source images were provided.
- No export. `reviewStatus` on both files remains `ai-generated`, pending your review of this expansion before Stage 10.
