# Question & Response Semantics — Design Proposal (M2)

**Status:** Slice 1 is implemented and reviewed. §5 has been corrected to match what was actually built — see the "As implemented" subsection — after a real architectural conflict was found between this document's original illustrative shape and ADR-001's existing private-answer-keys boundary. §§1–4 and §6–27 are otherwise the original design record, unmodified.
**Author:** Implementation agent (Claude).
**Scope:** §5 corrected post-implementation to reconcile design with what shipped. No schema, service, pipeline, or frontend file was changed to produce *this* documentation update — only `docs/Question-Response-Semantics-Design-Proposal.md` itself.
**Depends on:** Slice A1 (Structured Learning Content Foundation — closed, `6285263`/`5f1e948`). This document does not modify or revisit A1's model; it builds the next layer on top of it and explicitly preserves `Question.objectiveIds`.

---

## 1. Current-state assessment

The system today has exactly **one** question type, unnamed: a prompt string, answered with one free-text string, checked with exact-string equality. This isn't a simplification of a richer model — there is no richer model anywhere in the stack. Concretely:

- `backend/app/schemas/question.py`: `Question` has no `questionType`, no response shape, no marks. `hints: list[str]` and `solution: str` are the only content beyond the prompt.
- `backend/app/schemas/answer.py`: `AnswerSubmission` is `{answer: str, attemptNumber: int}`. `Evaluation` is `{isCorrect: bool, score: float}`, where `score` is only ever `0.0` or `1.0` in practice (§2).
- `backend/app/services/evaluation_service.py`: `evaluate()` is four lines — look up the expected answer, `submission.answer.strip() == expected_answer.strip()`, return binary. No question-type branching exists because there is nothing to branch on.
- `frontend/src/components/AnswerInput.tsx`: **one** input widget, a single `<input type="text">`, used identically by both `QuestionPage.tsx` (anonymous) and `SessionQuestionPage.tsx` (session/authenticated). Neither component has ever needed to know "what kind of question is this" — there's only one kind.
- Content already secretly disagrees with this. `docs/content-source/linear-equations/answer-keys.json`'s own note names `le-q21`–`le-q30` and `le-q37`–`le-q44` as "MCQ-letter answers, compound LHS/RHS answers, multi-part word-problem answers" that are "inherently weak fits for exact-string matching." Inspecting them directly confirms it: `le-q21` is a multiple-choice question whose `expectedAnswer` is `"(b) 2x + 5 = 11. It has exactly one variable..."` — a full explanatory sentence a real student would never type verbatim. `le-q25`/`le-q37`/`le-q40` each expect **two independent values** (LHS+RHS; two numbers; length+breadth) packed into one string. **This milestone is not inventing question-type diversity — it's naming diversity that already exists in shipped content and is already documented as broken.**

No `maxMarks`/`score`/partial-credit concept exists anywhere in canonical content, runtime schema, or the database. No `questionType` or `responseType` field exists anywhere. `attempts.misconception_tag` and `attempts.question_type` (SQLite columns, `attempt_service.py`) exist but have been unpopulated since before this project's Phase 1 began.

One structural fact from A1 carries over directly and must not regress: **`Question.objectiveIds: list[str] | None` already lets one question assess multiple learning objectives.** Nothing here revisits that.

---

## 2. Existing evaluation flow

Exact chain, traced end to end:

1. `answer_service.evaluate_answer(question_id, submission)` — the one shared entry point for **both** flows (see §14).
2. `evaluation_service.evaluate(question, submission)` — reads `answer_keys.json` (a private file, never `Question.solution`, per ADR-001), does `submission.answer.strip() == expected_answer.strip()`, returns `Evaluation(isCorrect, score)`.
3. `coaching_service.decide(is_correct, attempt_number)` — a pure function of exactly those two values, returns `(Coach, UiState)`. No dependency on question content, question type, or score magnitude.
4. `answer_service` assembles `AnswerEvaluationResponse{evaluation, coach, ui}`.

**Normalization today:** `.strip()` only. No case-folding, no whitespace collapsing, no numeric parsing. `test_evaluation_service.py` pins this exactly: exact match, incorrect match, leading/trailing whitespace trimmed, empty string is incorrect. Four tests, four behaviors — there is no more to the current evaluator than that.

**Correct/incorrect representation:** `isCorrect: bool` and `score: float` are set together, always in lockstep (`score = 1.0 if is_correct else 0.0`) — `score` today carries zero independent information beyond `isCorrect`.

**Coaching consumption:** `coaching_service.decide()` takes only `(is_correct, attempt_number)` — it has never read `score`, and (per `Phase-1-Handoff.md` §12.3) has no concept of hint usage either.

**Anonymous vs. authenticated duplication (§14 in full below):** `runtime_session_manager.py` calls `answer_service.evaluate_answer()` directly — the identical function the anonymous route (`POST /questions/{id}/answer`) calls. **There is no backend duplication of evaluation/coaching logic between the two flows today.** The duplication that exists is entirely in the frontend presentation layer (`QuestionPage.tsx` and `SessionQuestionPage.tsx` independently render the same input/hint/solution/feedback UI) — out of scope for a backend-first milestone that changes no frontend code.

---

## 3. Existing scoring/marking assessment

**There is no scoring concept beyond binary correctness anywhere in the system.** `Evaluation.score` is a `float` field that has only ever held `0.0` or `1.0`. No `maxScore`/`maxMarks` field exists on `Question`, in canonical content, or in the database. `SessionState.correctCount` (the only aggregate in `attempt_service`/session schemas) counts binary-correct answers, not accumulated score. Grepping the entire backend and content-source trees for `marks`/`maxScore`/`partialCredit`/`rubric` turns up exactly one hit, and it's prose inside a Data Handling solution string ("...8B scored 6 marks higher"), not a schema concept.

This means a scoring model can be introduced **additively, with a safe default, and zero behavioral change** — there is no existing scoring behavior to preserve compatibility with beyond "binary, out of one point," which is exactly what `maxScore: float = 1.0` defaults to (§7).

---

## 4. Proposed Question model

`Question` gains exactly two new fields, both additive, both defaulted so all 241 existing questions need no canonical edits to keep validating:

```
Question (extended):
  ...existing fields unchanged (id, chapterId, question, text, difficulty,
     hints, solution, topicId, objectiveIds)...
  questionType: QuestionType = "short_text"     # NEW, defaults to today's behavior
  responseSpecification: ResponseSpecification | None = None   # NEW, optional
  maxScore: float = 1.0                          # NEW, defaults to today's binary-out-of-1 behavior
```

`questionType` is a **first-class field** (Architectural Question A — yes). Rationale: `backend/app/schemas/session.py`'s `QuestionCandidate.type: str | None` already exists, already flows through `question_selector.py`'s `SelectedQuestion.type`, and is documented in its own comment as "no question-type field exists on the runtime Question schema yet (P2, not built)." This milestone doesn't invent a new concept — it finally gives meaning to a field the Learning Session Engine has been carrying, unused, since ADR-006/007. See §15 for why the Engine needs no other change.

`responseSpecification` is **not** embedded as a flat grab-bag of optional fields on `Question` (Architectural Question B — separate model, nested). A single `Question` with `options: list[str] | None`, `matchingPairs: dict | None`, `tolerance: float | None`, `blanks: list | None`, `parts: list | None` all living together is exactly the "huge union that becomes difficult to maintain" the brief warns against — every reader would need to know which fields are meaningful for which `questionType` by convention alone. A separate, `questionType`-discriminated `ResponseSpecification` keeps `Question`'s identity (what it's about, how hard it is, what it teaches) stable and type-agnostic, and keeps type-specific shape contained to the one place it's relevant. This mirrors A1's own precedent (`Concept`/`WorkedExample` nested under `Topic`, not flattened onto it).

---

## 5. Proposed Response Specification model

**Architectural Question D** (avoid a huge union) is answered by *not* building the full discriminated union now. `ResponseSpecification` stays deliberately small — only the fields an *implemented* evaluator actually reads.

### As originally proposed (illustrative — superseded by the correction below)

The first draft of this document sketched:

```
ResponseSpecification (original illustrative sketch — NOT what was built):
  acceptedAnswers: list[str]        # one or more equivalent correct forms
  caseSensitive: bool = false        # normalization knob
  numericTolerance: float | None = None   # present only for questionType == "numeric"
```

### As implemented — Slice 1 (corrected)

This shape was **not** carried into implementation as written. Scope-discipline review before coding surfaced a real architectural conflict, not a style preference:

**`acceptedAnswers` is not part of the implemented `ResponseSpecification`, and must never be.** `Question` — and therefore anything nested inside it — is returned directly by the public content routes (`GET /chapters/{id}/questions`, `GET /chapters/{id}/questions/{id}`). ADR-001 deliberately keeps expected answers in a **separate, private** `answer_keys.json`, resolved only through `evaluation_service.get_expected_answer()`, and explicitly never exposed on any content GET route. Putting `acceptedAnswers` on `ResponseSpecification` would have put the correct answer(s) directly into a public API response the moment a question opted into it — a real regression of an existing, deliberate boundary, not a hypothetical one. **Both Slice 1 evaluators (`short_text` and `numeric`) continue to resolve the expected answer exclusively through the existing private `answer_keys.json` path, for every `questionType`, with no exception.** This is an intentional architectural correction to this document's original illustrative proposal, not an accidental omission or a scope reduction under pressure.

**`caseSensitive` was also deliberately dropped**, for a separate, narrower reason: Slice 1's authorized scope for `short_text` was a *behavior-preserving extraction* of the existing evaluator, not a new capability. Today's comparison has always been case-sensitive (`.strip() ==`, nothing more); adding a `caseSensitive` toggle would have been a genuine new tuning capability, and an unused one at that (nothing in Slice 1 sets it to anything other than the implicit current behavior) — exactly what this project's no-speculative-fields discipline exists to prevent. `short_text` in Slice 1 has zero tunable parameters.

**What `ResponseSpecification` actually contains in Slice 1:**

```
ResponseSpecification (as implemented, backend/app/schemas/question.py):
  numericTolerance: float = 0.0
```

One field, consulted only by the `numeric` evaluator; `short_text` never reads `ResponseSpecification` at all (`Question.responseSpecification` stays `None` for every `short_text` question, including all 241 existing ones). This is the complete, exhaustive set of deterministic numeric tuning parameters actually authorized and implemented in Slice 1 — no other field exists on this model.

The **full future taxonomy** (still only documented, still not built) discriminates by `questionType`, and remains a real target — nothing about the correction above forecloses it:

| questionType | Future `ResponseSpecification` payload (not built in Slice 1) |
|---|---|
| `short_text` | Slice 1 — implemented, zero tunable parameters. A future slice *may* add a normalization/equivalence knob, but it isn't `acceptedAnswers`-shaped for the reason above — any future field here must still never carry an answer value. |
| `numeric` | `numericTolerance` (Slice 1 — implemented, above). |
| `single_choice` | `options: list[Option]`, `correctOptionId: str` |
| `multi_choice` | `options: list[Option]`, `correctOptionIds: list[str]` |
| `fill_blank` | `blanks: list[{id, acceptedAnswers}]` |
| `matching` | `leftItems: list[Item]`, `rightItems: list[Item]`, `correctPairs: list[{leftId, rightId}]` |
| `multi_part` | `parts: list[QuestionPart]` (§12) |

**Important correction to the table above, carried through from the same ADR-001 finding:** any future row that appears to name a "correct answer" field (`correctOptionId`, `correctPairs`, `acceptedAnswers` inside `blanks`) will need the same scrutiny applied here before implementation — if `Question` remains publicly readable when those types ship, the correct answer/option/pairing cannot live in `ResponseSpecification` as sketched; it will need to stay in a private structure analogous to today's `answer_keys.json`, resolved only at evaluation time. This table is illustrative of *shape* (what varies per type), not a pre-approved final field-by-field design — each row gets its own scrutiny when its slice is actually proposed.

Each row is added to the union **only when that type is actually implemented** — the taxonomy is named and reserved now (so nothing downstream has to guess at future shape), but `ResponseSpecification`'s Pydantic model literally only grows the fields a shipped evaluator needs, keeping the schema honest about what's real versus reserved.

### Note on `maxScore`/`scoreBreakdown`/`confidence` (§7/§8) — not the final model

For completeness, restated plainly here since it governs how §7/§8 should be read after implementation: `maxScore` is live, additive schema capability (every question has one, defaulting to `1.0`). `scoreBreakdown` and `confidence` are typed fields on `EvaluationResult` with **no producer** — no evaluator in Slice 1 sets either one, ever; they are always `None` in every response today. **No marking or partial-credit semantics are implemented anywhere in Slice 1.** None of these three fields should be read as the final future assessment model — they are seams, not a finished design, and each will get its own design/review pass (§25) when a slice actually needs to populate them.

### Non-goals, restated for this corrected section

Future Question & Response Semantics milestones may eventually introduce multi-part responses, marks/weights beyond `maxScore`, partial credit, acceptable alternatives, richer response structures (choice options, matching pairs, fill-blank slots), and rubric-based evaluation. **None of these are implemented by M2 Slice 1.** This is consistent with, not a change to, §24's existing non-goals list.

---

## 6. Proposed Evaluation model

**Architectural Question C** (strategy as data or code): both, cleanly separated. `questionType` (data) selects which evaluator (code) runs, via one small registry — not an `if/elif` ladder repeated across services:

```
Evaluator protocol (conceptual, one method):
  evaluate(question: Question, submission: AnswerSubmission) -> EvaluationResult

EVALUATORS: dict[QuestionType, Evaluator] = {
  "short_text": ShortTextEvaluator(),
  "numeric": NumericToleranceEvaluator(),
  # other QuestionType values intentionally have no entry yet
}

evaluation_service.evaluate(question, submission):
    evaluator = EVALUATORS[question.questionType]
    return evaluator.evaluate(question, submission)
```

This is the **one** dispatch point in the whole system. `answer_service`, `coaching_service`, the frontend, and the Learning Session Engine never see `questionType` or branch on it — they only ever see the resulting `EvaluationResult`, which is exactly what keeps type-specific logic from spreading (the brief's explicit warning). Tunable parameters within a type (tolerance, case sensitivity, accepted forms) are **data**, on `ResponseSpecification` — only the dispatch decision and the comparison algorithm itself are code.

**Normalization (Architectural Question G, mathematical equivalence) gets its own named seam now, kept trivial today:**

```
normalize(raw: str) -> str   # Slice 1: trim + (optionally) lowercase — literally
                              # today's .strip(), given a name and a home
```

A future `NumericEvaluator` doesn't do *string* normalization at all — it parses both the submission and each accepted answer into a canonical numeric value (Python `Fraction`/`Decimal`, not a symbolic engine) and compares numerically. This is what lets `1/2` and `0.5` and `4` and `4.0` compare equal **without any new dependency** — plain numeric parsing, not symbolic algebra. Full algebraic equivalence (`x = 4` vs. `4` "where context permits," equivalent expressions like `2(x+1)` vs. `2x+2`) is explicitly **not** designed here — it would need a real symbolic library (e.g. `sympy`) not currently in the repo, and is named as a future, separately-approved dependency decision (§23), not assumed.

---

## 7. Proposed Scoring model

**Architectural Question E.** `EvaluationResult` extends today's `Evaluation` rather than replacing it — every existing field stays, in the same meaning, so `coaching_service`'s current contract (`is_correct`, `attempt_number`) needs zero changes:

```
EvaluationResult (extends Evaluation):
  isCorrect: bool          # unchanged
  score: float              # unchanged in meaning: earned score
  maxScore: float = 1.0      # NEW — makes "out of what" explicit instead of implicit
  evaluatorId: str           # NEW — which evaluator produced this, e.g. "short_text_v1",
                              #        "numeric_tolerance_v1" — a stable version tag, not a
                              #        human description (§19: this is the AI-evaluator seam)
  scoreBreakdown: list[ScoreComponent] | None = None   # NEW, future (§11) — absent today
  confidence: float | None = None                       # NEW, future (§8/Question K) — absent today
```

For every one of the 241 existing questions and both Slice-1 evaluators, `maxScore` stays `1.0` and `score` stays `0.0`/`1.0` — **zero behavioral change**, the field exists purely so a future multi-part or partial-credit question can set `maxScore > 1.0` without a second breaking schema change later.

---

## 8. Proposed Learning Signal boundary

**Architectural Question J** (minimum common `EvaluationResult` contract) is answered in §7 above — that *is* the contract. This section is about what sits **downstream** of it, and what does not exist yet.

A future adaptive engine would eventually want: correctness, score, maxScore, `questionType`, `objectiveIds` (already exists, A1), `difficulty` (already exists), attempt count (already tracked, `attempt_service`), hint usage (already tracked per-session), misconception evidence, evaluator confidence, reasoning evidence. Per field:

| Signal | Now / Deferred / Future milestone | Why |
|---|---|---|
| `isCorrect`, `score` | **Now** (already exists) | Already the whole coaching contract; zero new cost. |
| `maxScore`, `evaluatorId` | **Now** (this milestone, §7) | Needed the moment more than one evaluator exists — without `evaluatorId`, a future consumer can't tell which comparison rule produced a result, which matters the instant an AI evaluator coexists with deterministic ones (§19). |
| `questionType`, `objectiveIds`, `difficulty` | **Already exist**, not new | `objectiveIds` is A1's; `difficulty`/`questionType` already live on `Question` — a learning-signal consumer reads the *question*, not a duplicated copy on every result. |
| Attempt count, hint usage | **Already tracked** (`attempt_service`, session state) | No new field needed — these are session/attempt concerns, not evaluation-result concerns; conflating them here would duplicate an existing source of truth. |
| `scoreBreakdown` (partial credit) | **Deferred to when a decomposable evaluator ships** (§11) | Speculative until a real multi-part/rubric evaluator exists to populate it; the *field* exists in §7's shape so it's not a breaking addition later, but nothing sets it in Slice 1. |
| `confidence` | **Deferred to AI evaluator milestone** (§19, Question K) | A deterministic evaluator has no meaningful confidence — see the explicit rule below. |
| `misconceptionTag` | **Deferred**, but the anchor already exists | `attempts.misconception_tag` (SQLite column) has been sitting unpopulated since before Phase 1. Several chapters' canonical content already authors a `misconception: {commonWrongAnswer, why, remediationHint}` object per question (Data Handling, Understanding Quadrilaterals, Squares and Cubes). A deterministic evaluator *could* eventually pattern-match a submission against `commonWrongAnswer` and populate this — real, concrete, not speculative — but it's not this milestone's job to build that matcher. |
| "Reasoning evidence" | **Out of scope entirely for now** | No deterministic representation of "reasoning" exists or is designed here; this is squarely a future AI-evaluator concern (§19), not named further. |

**Architectural Question K, answered directly:** `confidence: float | None` exists on `EvaluationResult` but **every deterministic evaluator (Slice 1 and its near-term successors) must leave it `None`, never default it to `1.0`.** A rule that isn't probabilistic doesn't have "confidence" — defaulting to `1.0` would be a fabricated signal, indistinguishable downstream from a genuinely confident AI evaluator. `None` means "no confidence signal was produced," which is the honest state for every evaluator this milestone builds.

---

## 9. Question type taxonomy

Per Architectural Question A and the brief's explicit list, seven types are named as the durable vocabulary. **Only two are implemented in Slice 1** (marked); the rest are reserved names with a documented future `ResponseSpecification` shape (§5) and no evaluator yet:

| `questionType` | Status | Maps to existing content |
|---|---|---|
| `short_text` | **Slice 1** (generalizes today's exact-match; default for all 241 legacy questions) | Every current question |
| `numeric` | **Slice 1** (new evaluator; opt-in per question) | Any question whose `expectedAnswer` is a bare number today (a large fraction of Squares and Cubes, for instance) |
| `single_choice` | Reserved | `le-q21`-style questions, today miscast as `short_text` with a full-sentence expected answer |
| `multi_choice` | Reserved | None identified yet in current content |
| `fill_blank` | Reserved | None identified yet in current content |
| `matching` | Reserved | None identified yet in current content |
| `multi_part` | Reserved | `le-q25`/`le-q37`/`le-q40`-style questions, today packing 2+ independent values into one string |

No content migration to the reserved types happens in this milestone (§13) — naming them now is what lets future content be authored correctly from day one instead of being retrofitted a second time.

---

## 10. Mathematical equivalence strategy

Answered in full in §6. Summary: a **normalization seam exists now** (trivial today — trim/case), and a **numeric-parsing evaluator** (Fraction/Decimal comparison, no symbolic engine) is the Slice-1-eligible way to solve `1/2 = 0.5` and `4 = 4.0`. Full algebraic equivalence is explicitly deferred and named as a future dependency decision, not designed here (§23).

---

## 11. Partial-credit strategy

No rubric engine is built. The future shape (§7's `scoreBreakdown`) is a flat list, not a tree, deliberately:

```
ScoreComponent (future, not Slice 1):
  component: str        # e.g. "method", "reasoning", "calculation", "final_answer"
  maxScore: float
  earnedScore: float
```

The **first real, deterministic source of partial credit is multi-part decomposition (§12), not a rubric engine.** A 3-part question with parts worth 2/1/2 marks naturally produces a `scoreBreakdown` with one component per part, summed into the parent's `score`/`maxScore` — no new grading concept needed beyond "evaluate each part with its own evaluator and add up the results." A true open-ended rubric (partial credit *within* a single free-text answer, e.g. "method = 2, reasoning = 1") is named as plausible future work but is **not designed further here** — it would need either an AI evaluator or a much more structured response format than free text, and building it now would be exactly the "rubric engine unless justified" the brief warns against building prematurely.

---

## 12. Multi-part question strategy

```
MultiPartResponseSpecification (future, not Slice 1):
  parts: list[QuestionPart]

QuestionPart:
  id: str
  prompt: str
  questionType: QuestionType          # each part can be its own type
  responseSpecification: ResponseSpecification
  maxScore: float
  objectiveIds: list[str] | None      # NEW at part level — see below
```

**Architectural Question H:** a part's `objectiveIds` is optional and **inherits the parent Question's `objectiveIds` when unset** — most multi-part questions test one objective through several steps and shouldn't require repeating the same id on every part, but a question that genuinely spans distinct objectives per part (plausible for a multi-step word problem touching two different skills) can override at the part level. This is a direct, explicit extension of A1's "one question, many objectives" model down to sub-question granularity — not a new mechanism.

`le-q25`/`le-q37`/`le-q40` (§1) are the concrete real-world targets this shape would eventually re-author correctly, once `multi_part` moves from reserved to implemented — not attempted in this milestone.

---

## 13. Backward compatibility with 241 questions

**Simpler than A1's migration, on purpose.** A1 had to reconcile two genuinely different *shapes* (flat string vs. structured sections) and needed a legacy/structured discriminator (`topicMigrationState.js`) because a half-migrated file was structurally ambiguous. This milestone has no such ambiguity: `questionType` defaults to `"short_text"` and `maxScore` defaults to `1.0` for **every** question that doesn't explicitly set them — there is no second shape to confuse it with, so **no discriminator is needed.**

- **How legacy questions keep working:** they simply never set `questionType`/`responseSpecification`/`maxScore` in canonical source; Stage 10's transform emits the defaults; the `short_text` evaluator (§6) is *exactly* today's `.strip()`-then-compare logic, so behavior is provably unchanged for all 241 questions with zero canonical edits.
- **How new types coexist:** a chapter can have some `short_text` questions and some `numeric` questions side by side in the same `stage6-questions.json` — there's nothing chapter-level or file-level to migrate, unlike A1's Topic-level state. Type is a per-question, independently-set property from day one.
- **"Can a legacy question be represented as an explicit default?"** Yes, and that *is* the design — `short_text` isn't a special "legacy" bucket, it's a real, first-class type that today's 241 questions happen to all use.
- **When legacy fields can eventually be removed:** never, in the sense that `short_text` isn't slated for removal (§9) — it's a permanent, legitimate type. What *would* eventually shrink is the fraction of questions still using it as new types are adopted for newly-authored content, which is a content-authoring decision, not a schema migration.

---

## 14. Anonymous/authenticated compatibility

Traced precisely in §2: `runtime_session_manager.py` already calls `answer_service.evaluate_answer()` directly — the same function the anonymous route calls. **This model doesn't create a shared boundary; one already exists at the service layer, and it's exactly where `EvaluationResult`/`Evaluator` dispatch will live.** Both flows benefit identically and automatically from any new evaluator, with no duplicated logic to keep in sync.

The one place duplication genuinely exists — `QuestionPage.tsx` vs. `SessionQuestionPage.tsx` independently rendering the same input/hint/solution/feedback UI — is a **frontend** concern, and this milestone changes no frontend code. It's named here so a future frontend milestone (rendering `single_choice` radio buttons, `matching` drag targets, etc.) inherits the awareness that whatever shared input component it builds needs to be built once and used by both pages, not twice.

---

## 15. Learning Session Engine impact

**None required for Slice 1**, and this is a genuine finding, not an assumption: `question_selector.py`'s `select()` function already accepts `SelectionConstraints.questionTypes` and already threads `SelectedQuestion.type` through from `QuestionCandidate.type` — but **the selection algorithm itself never reads or filters on `questionTypes` at all**; only `difficultyDistribution` and `excludeQuestionIds` affect which candidates get picked. `QuestionCandidate.type` is always `None` today (`content_repository.py`'s own comment: "no question-type field exists on the runtime Question schema yet"). This means:

- The FK/plumbing for question-type-aware selection **already exists**, unused, exactly like `objectiveIds` did before A1.
- Populating `QuestionCandidate.type` from the new `Question.questionType` (§4) is a **one-line, mechanical change** whenever it's wanted — but *activating real filtering logic* in `question_selector.select()` is a separate, deliberate decision this milestone does not make.
- `session_planner.py`, `session_builder.py`, `session_store.py`, `learning_context_service.py`, `attempt_service.py` need **zero** changes — none of them reference question type or evaluation shape at all.

This milestone's Definition of Done (§26) does not touch any Learning Session Engine file, matching the brief's explicit instruction to avoid unnecessary changes there.

---

## 16. Coaching impact

**No coaching redesign.** `coaching_service.decide(is_correct: bool, attempt_number: int)` keeps its exact current signature and behavior. Because `EvaluationResult` (§7) is `Evaluation` **extended**, not replaced, `answer_service` can keep calling `coaching_service.decide(evaluation_result.isCorrect, submission.attemptNumber)` unchanged — the new fields (`maxScore`, `evaluatorId`, `scoreBreakdown`, `confidence`) are simply never read by coaching in this milestone. The **minimum stable contract** a future richer coaching pass could build on is exactly `EvaluationResult` itself — `isCorrect` for the existing binary decision, `score`/`maxScore` for a future partial-credit-aware message ("close, but check your reasoning" for a 3/5 multi-part result), `confidence` for a future AI-evaluator-aware hedge ("this looks right, but double-check" for a low-confidence AI call). None of that is built now.

---

## 17. Stage 10/content-pipeline impact

Following A1's exact whitelist discipline (`transform.js`: no spread, every field named explicitly):

- **Canonical source** (`stage6-questions.json`): questions may optionally add `questionType` and a type-appropriate `responseSpecification` object; omitted means `short_text`. No change to `canonical-topic.json` or the Concept/WorkedExample/LearningObjective model at all — this milestone is orthogonal to A1's structure.
- **`loadCanonical.js`**: a new, small structural check — if `questionType` is present, it must be one of the seven named values (§9); if it names a type with no implemented `ResponseSpecification` shape yet (single_choice, multi_choice, fill_blank, matching, multi_part in Slice 1), that's a content-authoring error caught at export time, not a silent acceptance of an unusable question.
- **`transform.js`**: emits `questionType` (defaulted to `"short_text"`) and `maxScore` (defaulted to `1.0`) on every question, `responseSpecification` only when the canonical question provides one. No legacy/structured discriminator needed (§13).
- **Canonical-authoritative / runtime-projection boundary is unchanged and unthreatened.** Per A1's §R guardrail (already established, not repeated architecture here): any future AI-extracted or teacher-uploaded question content still enters through this same canonical layer and the same `reviewStatus`/approval gate before ever reaching `questionType`/`responseSpecification` in runtime data. **AI must never write directly to `backend/app/data/*.json`** — nothing in this design creates or implies a bypass.

---

## 18. Testing strategy

Mirrors A1's approach: a `ShortTextEvaluator`/`NumericToleranceEvaluator` unit-test suite (exact match, whitespace, empty-string, case-insensitivity toggle for short_text; tolerance boundary, fraction-vs-decimal equivalence, non-numeric-input rejection for numeric), an `EVALUATORS` registry dispatch test (right evaluator picked for `questionType`, unknown/reserved type raises rather than silently falling back), a Stage 10 pipeline test for the new structural checks (unknown `questionType` rejected; reserved-type-with-no-shape rejected), a regression pin proving all 241 existing questions evaluate identically before/after (same input/output pairs, `short_text` evaluator vs. today's `evaluate()`), and API-level tests confirming `EvaluationResult`'s new fields are present-but-inert (`maxScore: 1.0`, `evaluatorId` set, `confidence`/`scoreBreakdown` absent) for existing questions. Full existing suite (pytest, vitest, pipeline JS tests) must stay green with an empty diff outside the intentionally-changed files.

---

## 19. AI-readiness

**Architectural Question N.** The insertion point is exactly the `Evaluator` protocol (§6): a future `AIEvaluator` implements the same `evaluate(question, submission) -> EvaluationResult` signature as `ShortTextEvaluator`/`NumericToleranceEvaluator`, and gets registered in `EVALUATORS` for whichever `questionType`(s) it's approved to handle — **without changing `Question`, `answer_service`, `coaching_service`, or anything upstream of the registry.** The desired shape from the brief —

```
deterministic evaluator  OR  AI-assisted evaluator  →  common EvaluationResult  →  scoring  →  coaching/learning signal
```

— is exactly what §6/§7 already build: one common result contract, reached by either kind of evaluator, consumed identically downstream. This is the entire AI-readiness contribution of this milestone: **a clean seam, not a stub.** `evaluatorId` (§7) is what lets a future system distinguish which evaluator produced a given historical result once both kinds coexist. `confidence` (§8, Question K) is what lets an AI evaluator report genuine uncertainty without deterministic evaluators lying about having any. Nothing resembling an AI evaluator is implemented, stubbed, or scaffolded beyond this seam — no client, no prompt, no model call, matching Shadow Mode's own precedent (ADR-002: fully separate, out-of-band, until a real decision is made to use it).

---

## 20. Adaptive-learning readiness

**Architectural Question O.** Same relationship as A1's `objectiveIds` had to future adaptive practice: this milestone makes richer signals *structurally possible* (per-question `maxScore`/`score` instead of only binary; `evaluatorId`; the seam for `confidence`/`misconceptionTag`) without building any adaptive logic. `learning_context_service.py` and `attempt_service.py` are untouched (§15) — a future adaptive milestone would extend `attempt_service.record_attempt` to also persist `maxScore`/`score` (currently only `is_correct` is stored) and could then compute accuracy-weighted-by-difficulty or partial-credit-aware mastery instead of pure correct/incorrect counting. **Not designed further here** — named as the natural next question, not answered.

---

## 21. Teacher-content-intelligence readiness

**Architectural Question P.** This milestone's contribution is narrow and specific: **the canonical vocabulary a teacher-upload/AI-extraction pipeline would need to target already exists and is stable** — `questionType`, `responseSpecification`, `maxScore`, all flowing through the same `reviewStatus`-gated canonical→export→runtime boundary A1 and ADR-003 already established (§17). A future extraction pipeline's job becomes "produce a candidate `stage6-questions.json` entry with a `questionType` and `responseSpecification` a human reviewer can check," not "invent a representation from scratch." Nothing about extraction, AI-assisted authoring, upload handling, or a review UI is designed or implied here — those remain entirely future work, gated on their own design pass, per A1's §R guardrail (already established: AI-generated content enters through the human-approval gate like everything else, never around it).

---

## 22. Cross-class/cross-subject extensibility

**Architectural Question Q.** Auditing every field proposed in §4–§7 for a Class-8-Math assumption:

| Subject-neutral (safe to reuse for another grade/subject) | Math-specific (deliberately, for now) |
|---|---|
| `questionType` taxonomy (§9) — single/multi-choice, fill-blank, matching, short-text, multi-part are universal question shapes, not math-specific | `numeric` evaluator's tolerance/fraction-parsing logic — genuinely math-specific comparison semantics |
| `ResponseSpecification`'s structural shape (options, pairs, blanks, parts) | Future symbolic/algebraic equivalence (§6/§10) — inherently math |
| `EvaluationResult`/scoring/`maxScore`/`scoreBreakdown` — generic marks concepts used across every subject in real schooling | — |
| `Evaluator` protocol/registry pattern — a strategy dispatch has no subject coupling | — |
| Stage 10's canonical→approval→runtime boundary — already subject-agnostic (chapters are just data) | — |

Nothing in this design hard-codes Class 8 or Mathematics beyond the one evaluator (`numeric`) whose comparison *algorithm* is inherently mathematical — which is correct and expected, not a smell. No generic education platform is built; the taxonomy and contracts simply don't gratuitously assume math where they don't need to.

---

## 23. Risks and alternatives considered

| Alternative | Why not chosen |
|---|---|
| Flatten `ResponseSpecification` directly onto `Question` | Explicitly the "huge union" anti-pattern the brief warns against — rejected in §4/§5. |
| `if questionType == "mcq": ... elif ...` inline in `evaluation_service` | Exactly the anti-pattern named in the brief — rejected in favor of the `Evaluator` registry (§6), the one dispatch point. |
| Default deterministic evaluators' `confidence` to `1.0` for schema simplicity | A fabricated signal, indistinguishable from genuine AI confidence downstream — rejected explicitly (§8, Question K). |
| Build a general rubric engine now, since partial credit is clearly coming | Speculative ahead of a real decomposable evaluator; multi-part decomposition (§11/§12) gives real partial credit without one. |
| Introduce symbolic algebra (`sympy` or similar) now for "true" mathematical equivalence | Not in the repo today; a real new dependency decision that deserves its own review, not a default reached for inside this milestone (§6/§10). |
| Redesign `AnswerSubmission` into a response-type union now | Would force a frontend change (new input widgets) this milestone is explicitly barred from making; deferred until a type needing non-string input is actually implemented. |
| Add a legacy/structured discriminator like A1's `topicMigrationState.js` | Unnecessary — this migration has one shape with defaults, not two shapes needing reconciliation (§13). |

**Named risk:** `question_selector.py`'s dormant `questionTypes`/`type` fields could be mistaken for "already working" by a future contributor since they're threaded through the whole Session Plan → Constraints → Selector chain — they are not; the selector never reads them. Worth a code comment when `QuestionCandidate.type` is actually populated, not fixed here.

---

## 24. Explicit non-goals

Per the brief, restated as a checklist:

- No RAG, embeddings, vector database, or LLM evaluator client of any kind.
- No adaptive-learning/mastery/selection-logic engine.
- No symbolic algebra / equivalent-expression engine.
- No general rubric engine.
- No frontend changes of any kind — no new input widgets, no `questionType`-aware rendering.
- No implementation of `single_choice`, `multi_choice`, `fill_blank`, `matching`, or `multi_part` evaluators (named/reserved only).
- No Learning Session Engine selection-logic changes (the field plumbing already exists; activating it does not).
- No `coaching_service` redesign.
- No teacher-upload, extraction, or review-UI work of any kind.
- No migration of any of the 241 existing questions to a new `questionType` — they stay `short_text` by default.
- No changes to A1's `Concept`/`WorkedExample`/`LearningObjective`/`objectiveIds` model.

---

## 25. Recommended milestone slices

1. **This milestone (M2), Slice 1** — `Question.questionType`/`maxScore` (additive, defaulted), `ResponseSpecification` (minimal shape), `EvaluationResult` (extends `Evaluation`), `Evaluator` protocol + registry with **`ShortTextEvaluator`** (behavior-preserving generalization of today's logic) and **`NumericToleranceEvaluator`** (new, opt-in, real user-facing value with zero frontend change). Stage 10 structural validation for `questionType`. See §26.
2. *(Future, separate approval)* `single_choice`/`multi_choice` evaluators + the frontend input widgets they require (this is the first slice that must touch the frontend).
3. *(Future)* `multi_part` evaluator + `scoreBreakdown` partial credit, targeting the real `le-q25`/`le-q37`/`le-q40`-style content named in §1/§12.
4. *(Future)* `fill_blank`/`matching` evaluators + frontend widgets.
5. *(Future, evidence-gated)* Symbolic/algebraic equivalence, if numeric-only equivalence proves insufficient.
6. *(Future, separate milestone)* AI evaluator registration, adaptive selection using `questionTypes`, misconception-tag population from existing per-question `misconception` content.

---

## 26. Definition of Done for the first implementation slice (Slice 1 only)

- [ ] `backend/app/schemas/question.py`: `questionType: QuestionType = "short_text"`, `maxScore: float = 1.0` added, additive.
- [ ] New `ResponseSpecification` model (minimal shape, §5) added, optional on `Question`.
- [ ] `backend/app/schemas/answer.py` (or a new module): `EvaluationResult` extends `Evaluation` with `maxScore`, `evaluatorId`, `scoreBreakdown: None`, `confidence: None` — the latter two always absent/`None` in this slice.
- [ ] `Evaluator` protocol + `EVALUATORS` registry; `ShortTextEvaluator` (provably identical behavior to today's `evaluate()`) and `NumericToleranceEvaluator` (new).
- [ ] `evaluation_service.evaluate()` becomes a one-line dispatch through the registry.
- [ ] `answer_service.py`, `coaching_service.py`: **zero behavioral changes** — confirmed by empty diff beyond call-site type updates if any.
- [ ] Stage 10 (`loadCanonical.js`, `transform.js`): `questionType` structural validation; defaults emitted for all untouched questions.
- [ ] At least one real chapter gets one or more questions opted into `numeric` (pilot, mirroring A1's single-pilot-chapter approach) — candidate: Squares and Cubes, whose answer keys are already mostly bare numbers.
- [ ] Regression proof: all 241 existing questions produce identical `isCorrect`/`score` before and after, for the same submitted answers.
- [ ] Full test suite green (backend pytest, frontend vitest, Stage 10 JS tests) — confirmed empty diff on every Learning Session Engine file and every frontend file.
- [ ] Live verification: an existing `short_text` question and the new pilot `numeric` question(s) both evaluate correctly via the real API, both flows (anonymous `/questions/{id}/answer` and session `/sessions/{id}/answer`).

---

## 27. Decisions requiring Product Architect approval

1. **Authorization to begin implementation** of the slice in §26 — this document is design only.
2. **Pilot chapter/questions for `numeric`** — Squares and Cubes proposed (§26), needs explicit sign-off, same pattern as A1's pilot-chapter approval.
3. **`evaluatorId` naming/versioning convention** (e.g. `"short_text_v1"`) — a small but durable choice, worth fixing deliberately rather than by default.
4. **Whether Stage 10 should hard-reject a canonical question naming a reserved-but-unimplemented `questionType`** (this draft's recommendation, §17) or merely warn — affects how early content authors can start drafting future-type content.
5. **Timing of the symbolic-algebra dependency decision** (§6/§10/§23) — not needed for Slice 1, but worth the Product Architect flagging when it becomes a live question rather than leaving it perpetually deferred.

---

### Post-implementation note — pilot chapter deviation (added 2026-08-19, M2 Documentation & Architecture Reconciliation)

§26 and §27 item 2 above propose Squares and Cubes as the `numeric` pilot chapter, pending Product Architect sign-off. The actual M2.4 implementation (`2e0205d`, 2026-08-17) piloted `numeric` — together with `single_choice`/`multi_choice`, by then also implemented — in **Linear Equations** instead. Per `Development-Journal.md`'s 2026-08-17 (M2.4) entry: *"The pilot landed in Linear Equations rather than the originally-proposed Squares and Cubes because Linear Equations is where the documented brittleness actually lives."* §26/§27 above are retained unmodified as the original design record; this note is the reconciliation of that record against what shipped. No other claim in §1–§27 is affected — the pilot-chapter choice was the one open decision this document left to implementation-time sign-off.

---

## Appendix: Architectural Questions A–Q, answered

| # | Question | Answer | Where |
|---|---|---|---|
| A | Should `questionType` be first-class? | Yes — already half-exists in the Session Engine, unused. | §4 |
| B | Embedded in Question or separate `ResponseSpecification`? | Separate, nested (mirrors A1's `Concept`/`WorkedExample` precedent). | §4 |
| C | Evaluation strategy as data or code? | Both: `questionType` (data) selects an `Evaluator` (code) via one registry. | §6 |
| D | How to avoid a huge response-type union? | Minimal Slice-1 shape; full taxonomy documented but only populated per shipped type. | §5 |
| E | How should marks/scoring be represented? | `maxScore`/`score` on `EvaluationResult`, extending (not replacing) today's `Evaluation`. | §7 |
| F | How should partial credit eventually work? | Multi-part decomposition first (deterministic, real); generic rubric explicitly deferred. | §11/§12 |
| G | How should mathematical equivalence eventually work? | Numeric parsing (Fraction/Decimal) now-eligible; symbolic algebra explicitly deferred, named as a future dependency decision. | §6/§10 |
| H | How do multi-part questions relate to objectives? | Each part may override `objectiveIds`, inheriting the parent's when unset. | §12 |
| I | Can one question assess multiple objectives? | Yes — A1's `objectiveIds` capability is unchanged and explicitly preserved. | §4/§9 |
| J | Minimum common `EvaluationResult` contract? | `isCorrect`, `score`, `maxScore`, `evaluatorId` (+ future `scoreBreakdown`/`confidence`). | §7/§8 |
| K | Evaluator confidence for deterministic evaluators? | `confidence: float \| None`, and deterministic evaluators must leave it `None`, never fabricate `1.0`. | §8 |
| L | Where does misconception evidence attach? | `EvaluationResult.misconceptionTag` (future), anchored to the already-unused `attempts.misconception_tag` column and existing per-question `misconception` content. | §8 |
| M | What must remain outside this milestone? | Full checklist. | §24 |
| N | How does this prepare for AI evaluation? | `Evaluator` protocol is the seam; an `AIEvaluator` slots into the same registry. | §19 |
| O | How does this prepare for adaptive learning? | Richer signals become structurally possible (`maxScore`/`score`/`evaluatorId`); no adaptive logic built. | §20 |
| P | How does this prepare for teacher-generated content? | Stable canonical vocabulary (`questionType`/`responseSpecification`) for a future extraction pipeline to target, through the same approval gate. | §21 |
| Q | How does this remain extensible beyond Class 8 Math? | Audited field-by-field; only the `numeric` evaluator's comparison algorithm is math-specific, correctly so. | §22 |

---

# Part II — M2 Slice 2+ and Future Architecture

**Status:** Design only, as of when this section was written. M2 Slice 1 (`e41670a`) is closed and unaffected by this section. No implementation code, canonical content, runtime data, or frontend file was changed to produce this section. Written per explicit Product Architect directive to protect the broader product roadmap architecturally before authorizing Slice 2.
**Method:** Every claim about current code below was re-verified against the repository during this pass, not carried over from memory of earlier design work — see the closing report for the exact files re-inspected.
**Update (2026-08-19, M2 Documentation & Architecture Reconciliation):** `single_choice` (M2 Slice 2, `87e8414`) and `multi_choice` (M2 Slice 3, `e120a1d`) — named in §M as the "next candidate" and recommended sequence — have since shipped and closed, followed by M2.4's content-activation pilot (`2e0205d`). §M and §N's inline "IMPLEMENTED" annotations reflect that. The "Design only" status above describes this section's content *at the time it was written*, before either slice existed — it is not a live status flag and has not been updated to "Implemented," since Part II as a whole is a design document, not a status tracker; individual capabilities' current status is §N's table, not this banner. The remainder of Part II not marked IMPLEMENTED in §N (`multi_part`, `fill_blank`/`match_following`, richer `EvaluationResult` fields, and everything under "Then, separately, as their own milestones" in §M) is still design-only, not implemented, as of this update.

This section does not re-litigate anything already decided in Part I (§1–§27) or its Appendix. It extends the same model forward, and where it finds Slice 1's shape genuinely insufficient for what's coming, it says so explicitly (per your instruction not to treat Slice 1 as automatically final) — without implementing any of it.

---

## A. Question type model

**`questionType` should remain a simple string enum/registry key — not a class-hierarchy taxonomy.** The six requested types (`short_text`, `numeric`, MCQ, `fill_blank`, `match_following`, `multi_part`) are a small, closed, known vocabulary; the axis that actually varies per type is *payload shape* (§B), not *taxonomic behavior*. A formal taxonomy (base classes, capability flags, subtyping) would be solving a problem this vocabulary doesn't have — six known strings and a dict lookup (§D) is the correct, minimum mechanism, and it already proved out in Slice 1 with two types. `QuestionType` stays a `Literal[...]`, extended with new string values one at a time as each ships, exactly as Slice 1 already reserved five unimplemented values.

**MCQ needs to split into two real types, not stay one**, matching what the original taxonomy already named separately: `single_choice` (pick exactly one) and `multi_choice` (select all that apply) have genuinely different evaluation semantics (§B) — collapsing them into one "MCQ" type would immediately reintroduce a branch inside the evaluator. Both existed as separate reserved values since Slice 1; nothing changes here except confirming the taxonomy was already right.

**Minimum structural need per type** (shape detail in §B; this is the *what*, not the *how*):

| Type | What must be public (rendering) | What must stay private (correctness) |
|---|---|---|
| `short_text` | prompt only | expected answer(s) — unchanged from Slice 1 |
| `numeric` | prompt + tolerance | expected numeric value — unchanged from Slice 1 |
| `single_choice` | prompt + option list (text) | which option id is correct |
| `multi_choice` | prompt + option list (text) | which option id(s) are correct + partial-credit policy |
| `fill_blank` | prompt with blank markers | per-blank expected answer(s) |
| `match_following` | prompt + both item lists (text) | the correct pairing |
| `multi_part` | prompt + each part's own public shape (recursive) | each part's own private answer (recursive) |

**Future types that should NOT yet be implemented**, named explicitly so they aren't accidentally reached for later without their own design pass: `true_false` (deliberately *not* a separate type — model it as a 2-option `single_choice`, since a dedicated type would be redundant with no new capability); open-ended/essay free response (needs rubric or AI evaluation, both explicitly deferred, §B/§C); symbolic/algebraic equivalence response (needs a real symbolic-math dependency decision, already deferred in Part I §6/§10/§23); diagram/geometry-construction response (named in the product's own north-star vision, no representation designed here at all); ordered-step/sequencing questions (distinct from matching — arranging items into a correct order — not in the currently authorized list, not designed here).

---

## B. Response Specification

The central discipline carried forward from Slice 1's ADR-001 correction, now generalized and named explicitly as a **three-way split** that every future type must respect:

1. **Public question metadata** — returned by `GET /chapters/{id}/questions` and `GET /chapters/{id}/questions/{id}`. Includes the prompt, `questionType`, `difficulty`, `hints`, `objectiveIds`, `maxScore`, and — new insight this section adds — **the public *shape* of a valid response for types where the response-shape itself must be rendered**: an MCQ's option *text* (a student must see the choices to choose one), a matching question's both item lists (must see all items to pair them), a multi-part question's per-part prompts and structure. None of this reveals *which* option/pairing is correct.
2. **Student response (submission)** — what a student actually sends. Evolves from today's flat `AnswerSubmission.answer: str` into a `questionType`-discriminated shape (below). This is the field that requires new frontend input widgets (§E) — it did not need to change in Slice 1 only because both `short_text` and `numeric` happen to fit naturally into "one string."
3. **Private expected-answer/evaluation data** — extends today's `answer_keys.json` (currently `{questionId: str}`). Never returned by any GET route, resolved only at evaluation time, exactly as ADR-001 already establishes. This is where "which option is correct," "the correct pairing," and "each blank's accepted answer(s)" all live.

**The insight worth stating plainly:** Slice 1's correction (§5 above) discovered that for `short_text`/`numeric`, the *entire* expected value had to move to bucket 3. For choice-based and matching types, only *half* the information is private — the options/items themselves are legitimately public (bucket 1), and only the *correctness mapping* is private (bucket 3). Every future `ResponseSpecification` addition must be evaluated against this three-way split before it's written, not assumed safe by analogy to Slice 1.

**Proposed future shapes (design only, none built):**

```
ResponseSpecification (public, discriminated by questionType):

  short_text:  { }                          # unchanged — zero tunable params today;
                                              # a future case-insensitivity/alternate-forms
                                              # knob is plausible but evidence-gated, not
                                              # designed further here (Part I §5's ruling stands)
  numeric:     { numericTolerance: float }   # unchanged from Slice 1

  single_choice:  { options: list[{id: str, text: str}] }
  multi_choice:   { options: list[{id: str, text: str}] }   # IMPLEMENTED, M2 Slice 3 — identical
                                                               # shape to single_choice's own options;
                                                               # no partialCreditMode field was added
                                                               # (Slice 3 authorized all-or-nothing
                                                               # exact-set scoring only — see the
                                                               # correction below)
  fill_blank:     { blankIds: list[str] }    # positions/count only — the prompt text itself
                                               # carries the markers (e.g. "{{blank1}}")
  match_following:{ leftItems: list[{id, text}], rightItems: list[{id, text}] }
  multi_part:     { parts: list[QuestionPart] }   # see §G — recursive, self-similar

QuestionPart (public, one per multi_part sub-question):
  id: str
  prompt: str
  questionType: QuestionType
  responseSpecification: ResponseSpecification | None
  maxScore: float
  objectiveIds: list[str] | None    # inherits the parent Question's when unset
```

```
ResponseSubmission (student response, discriminated by questionType):

  short_text / numeric:  { answer: str }             # unchanged from Slice 1
  single_choice:          { selectedOptionId: str }
  multi_choice:            { answer: str }   # IMPLEMENTED, M2 Slice 3 — corrected from the
                                               # `selectedOptionIds: list[str]` originally
                                               # sketched here. No new AnswerSubmission/session
                                               # field was introduced: selected option ids are
                                               # joined into the SAME comma-delimited string
                                               # convention (e.g. "optA,optC,optD") that
                                               # short_text/numeric/single_choice already share,
                                               # parsed only inside the multi_choice evaluator.
  fill_blank:              { blankAnswers: dict[str, str] }   # blankId -> submitted text
  match_following:         { pairs: list[{leftId: str, rightId: str}] }
  multi_part:              { partResponses: dict[str, ResponseSubmission] }  # partId -> recursive
```

```
Private answer-key entry (answer_keys.json value, discriminated by questionType — currently always str):

  short_text / numeric:  "expected string"                          # unchanged from Slice 1
  single_choice:          { correctOptionId: str }
  multi_choice:            "optA,optC,optD"   # IMPLEMENTED, M2 Slice 3 — corrected from the
                                                # `{correctOptionIds: list[str]}` originally
                                                # sketched here. Stays a plain string —
                                                # answer_keys.json's dict[str, str] shape is
                                                # unchanged — using the same comma-delimited
                                                # option-id convention as the submission above,
                                                # opaque to everything except the multi_choice
                                                # evaluator.
  fill_blank:              { blankAnswers: dict[str, list[str]] }    # blankId -> accepted forms
  match_following:         { correctPairs: list[{leftId, rightId}] }
  multi_part:              { parts: dict[str, <this same union, recursively>] }   # partId -> answer
```

**Case sensitivity:** confirmed not genuinely required yet, restated from Part I §5 — and choice/matching types sidestep the question entirely by design, since they compare **opaque stable ids**, never option/item *text*. Case sensitivity only becomes a live question for `short_text`/`fill_blank`, and only once real content demonstrates a need (evidence-gated, not designed further here).

**Marks/weights:** `maxScore` (Slice 1) is sufficient at the whole-question level and needs no change. Per-part marks are `QuestionPart.maxScore` (above), summed into the parent's `maxScore` — no separate "weight" concept needed.

**Partial credit / all-or-nothing — RESOLVED, M2 Slice 3:** `single_choice` is inherently all-or-nothing (exactly one right answer). The `partialCreditMode` field sketched in an earlier draft of this section is retired: Slice 3's Product Architect authorization settled the `multi_choice` policy question without a field — exact-set equality, all-or-nothing, no partial credit, no per-option weighting, no negative marking. A `proportional` mode remains a plausible future direction but is not designed, flagged, or reserved by any field today; if ever wanted, it would be a new, separately-authorized capability, not a dormant switch already sitting in the schema.

**Future rubric support:** kept genuinely separate and later than everything else in this section — scoring partial credit *within one free-text answer* (e.g. "method=2, reasoning=1") is fundamentally different from multi-part decomposition (§G gives real, deterministic partial credit without a rubric at all) and likely needs AI assistance to be practical for open-ended text. Not designed further here; named in §N as deliberately deferred.

---

## C. Assessment / marking semantics — critique of the current `EvaluationResult`

Per your explicit instruction to critically assess, not just extend:

| Field | Verdict | Reasoning |
|---|---|---|
| `maxScore: float` | **Sufficient, keep as-is.** | Already exactly "out of what" at the whole-question level; nothing in this design changes its meaning. |
| `evaluatorId: str` | **Sufficient, keep as-is.** | Already a stable, versioned identifier; the seam for AI evaluators (§J) needs nothing more. |
| `scoreBreakdown: list[ScoreComponent] \| None` | **Should be restructured, not simply reused, when multi-part ships.** | See below — this is the one genuine correction this section makes. |
| `confidence: float \| None` | **Sufficient as designed; extend later, don't change now.** | The "deterministic evaluators must leave it `None`" rule (Part I §8, Question K) still holds. Once multi-part *and* AI evaluation coexist, a per-part confidence becomes meaningful — that's a property of a future `PartEvaluationResult` (below), not a reason to change the parent field now. |
| *(new)* "reason/evidence for evaluation" | **Missing, should be added when it has a producer.** | Not present in `EvaluationResult` at all today. Shadow Mode's existing (experimental, unused-in-production) `AIEvaluation.explanation: str` is a real, already-built precedent for exactly this — nothing needs inventing, just naming the eventual production field the same way. |

**The genuine correction:** `scoreBreakdown`'s current shape — a flat list of `{component, maxScore, earnedScore}` — was designed in Part I with *within-one-answer rubric decomposition* in mind ("method"/"reasoning"/"calculation"). Multi-part decomposition (§G) is a **different axis**: it's "N independent sub-questions, each with its own evaluator result," not "N named pieces of credit within one answer." Conflating them into one field would be a mistake — a multi-part result needs `partResults: list[PartEvaluationResult]` (each a near-complete `EvaluationResult` for that part, keyed by `partId`), kept **separate** from `scoreBreakdown` (which stays reserved for a future single-response rubric evaluator). Proposed future shape, not built now:

```
EvaluationResult (proposed future shape — NOT implemented in Slice 1 or this design):
  isCorrect: bool          # for multi_part: True only if every part is correct — keeps
                             # coaching_service's existing binary contract untouched (§H)
  score: float
  maxScore: float
  evaluatorId: str
  confidence: float | None = None
  evidence: str | None = None                              # NEW — mirrors AIEvaluation.explanation
  partResults: list[PartEvaluationResult] | None = None      # NEW — multi-part decomposition
  scoreBreakdown: list[ScoreComponent] | None = None          # kept, scope narrowed to within-answer rubric only

PartEvaluationResult (proposed, not built):
  partId: str
  isCorrect: bool
  score: float
  maxScore: float
  evaluatorId: str
  confidence: float | None = None
```

This is a proposed **future** evolution requiring its own approval when multi-part is actually authorized (§M) — not a retroactive change to Slice 1's shipped schema, and not implemented by this document.

---

## D. Evaluator architecture

**The registry (`_EVALUATORS: dict[str, Callable]`) remains appropriate and needs no structural redesign** for MCQ/fill_blank/matching/multi_part — this is a direct, verified answer, not an assumption. Each new type is still a plain function `(question, submission) -> EvaluationResult`, added to the same dict; the dispatch mechanism (`evaluate()`'s one lookup) is unchanged regardless of how many entries exist.

**The one real design question `multi_part` raises:** its evaluator must call *other* evaluators recursively — for each `QuestionPart`, resolve `_EVALUATORS[part.questionType]` and invoke it against a synthesized part-shaped input, then aggregate into `partResults` (§C) and sum `score`/`maxScore`. This is natural composition — the SAME dict, called recursively, not a second dispatch mechanism — and is a good validation that the registry pattern scales to the hardest case (multi-part) without needing to be redesigned.

**`AnswerSubmission` becomes a discriminated union** (§B's `ResponseSubmission`) once any type beyond `short_text`/`numeric` ships — evaluator function *signatures* stay `(question, submission) -> EvaluationResult`; only `submission`'s type gets richer. No change to the dispatch mechanism itself.

**Module organization:** the evaluators stay plain functions inside `evaluation_service.py`, unchanged, until roughly the third or fourth evaluator is added — at that point splitting into a dedicated `evaluators.py` (still plain functions, no classes, matching this project's service-module convention) becomes a reasonable, low-risk readability improvement to bundle into whichever slice adds that evaluator. Not needed today; named so it isn't forgotten as unplanned scope creep later.

**If/elif avoidance confirmed:** no new dispatch point is introduced anywhere, including inside `multi_part`'s recursion — it reuses the one existing dict.

---

## E. Frontend architecture

**Design:** a `questionType`-keyed response-component registry on the frontend, mirroring the backend evaluator registry — e.g. `RESPONSE_COMPONENTS: Record<QuestionType, ComponentType<ResponseInputProps>>`. `QuestionPage.tsx` and `SessionQuestionPage.tsx` would each render **one** generic `<QuestionResponseInput questionType={...} responseSpecification={...} value={...} onChange={...} />` that does the registry lookup internally — neither page needs to know about any individual type, which is exactly the coupling the brief asked to avoid.

- **`AnswerInput`** stays as the `short_text`/`numeric` component (already correct, unchanged) — it becomes one entry in the registry rather than the only option.
- **Type-specific components** (future, not designed pixel-by-pixel here): `SingleChoiceInput` (radio group over `options`), `MultiChoiceInput` (checkbox group), `FillBlankInput` (inline inputs at blank positions), `MatchingInput` (paired-selection UI), `MultiPartInput` (renders each part's own registry-resolved component recursively — the same self-similar structure as the backend).
- **Response state:** evolves from a flat `string` to a union matching `ResponseSubmission`; the shared input component owns its own internal state and emits a normalized value up via `onChange` — parent pages stay unaware of the internal shape.
- **Validation:** type-specific (e.g. "at least one option selected," "all pairs assigned") lives *inside* each type-specific component, not in the parent pages — same coupling avoidance.
- **Submission payload:** `AnswerSubmission`/`SubmitSessionAnswerRequest` carry the richer union instead of flat `answer: string` — a real, coordinated backend+frontend contract change, only needed once a type beyond `short_text`/`numeric` actually ships.
- **Result rendering:** multi-part/partial-credit results need per-part feedback (e.g. "2 of 3 marks," a visual breakdown) — a genuinely new UI concept, not designed further here.

**Which changes belong in Slice 2 vs later — an explicit trade-off, not a default:** Slice 1 stayed frontend-free only because a number typed into a text box is still just a string; MCQ/fill_blank/matching/multi_part all fundamentally need real input widgets for a good student experience. A stopgap exists (e.g. MCQ answered by typing the option letter into the existing free-text box) but is a materially worse experience than numeric's stopgap was, and I don't recommend it as more than a named option. **The honest options for Slice 2 are: (a) another backend-only increment if one exists that doesn't need new UI, or (b) the first slice that legitimately requires frontend work, most naturally `single_choice` (backend evaluator + minimal choice-rendering UI, bundled).** This is flagged as a decision needing your explicit sign-off (§O) rather than something this document decides.

---

## F. Canonical content + export pipeline

Following A1's principle exactly — **canonical structured content → validated runtime projection** — restated, not redesigned:

- `questionType`/`responseSpecification` already live in `stage6-questions.json` per-question (Slice 1); this continues unchanged as new types are added, each gated the same way `numeric` was: `loadCanonical.js`'s `EXPORTABLE_QUESTION_TYPES` set gains a new value **only** in the same slice that ships that type's evaluator, `ResponseSpecification` shape, and `answer_keys.json` value shape together — never partially, exactly as Slice 1's structural check already enforces for the five still-reserved types.
- `answer_keys.json`'s per-question value evolves from always-`str` to the type-dependent union in §B — still the **single private file**, still resolved only through `evaluation_service.get_expected_answer()`-equivalent access, still never touched by `loadCanonical.js`'s existing `typeof value !== 'string'` check until that check is deliberately extended for the specific type being added.
- **Migration of existing free-text questions** (e.g. `le-q21`, `le-q25`, `le-q37`, `le-q40`) is content-authoring work, not schema/pipeline work — re-authoring them with real `options`/multi-part structure happens deliberately, question-by-question or chapter-by-chapter, whenever a future slice chooses a pilot, mirroring A1's single-chapter pilot discipline. **Never en masse**, and not scheduled by this document.
- **Backward compatibility:** identical principle to every prior slice — every new field additive and defaulted; zero canonical edits required for any of the 241 existing questions, ever, as a side effect of adding a new type.
- **Determinism:** `transform.js`'s whitelist-only, field-by-field, no-spread discipline is a hard, already-established invariant — nothing in this design asks for or implies an exception to it.

---

## G. Multi-part questions (special attention, as requested)

Concrete real targets, already identified in Part I §1/§12 and reconfirmed here: `le-q25` ("Identify the LHS and RHS of the equation..."), `le-q37`, `le-q40` — each currently packs 2 independent values into one exact-match string, already flagged as brittle in the chapter's own `answer-keys.json` note.

**Structural representation** (full shapes already given in §B/§C; this section states the *composition*, which is the design-worthy part): a `multi_part` `Question` is a Question whose `responseSpecification.parts` is a list of `QuestionPart`, each of which is **structurally a smaller Question** — its own `questionType`, its own `ResponseSpecification`, its own `maxScore`, its own (optional, parent-inheriting) `objectiveIds`. This self-similarity is deliberate: it means multi-part needs **no new evaluation concept**, only recursive reuse of the same registry (§D) and the same three-way public/submission/private split (§B) at the part level.

**Evaluation:** `_evaluate_multi_part` dispatches each part through `_EVALUATORS[part.questionType]`, collects one `PartEvaluationResult` per part (§C), sums `score`/`maxScore`, and sets the parent `isCorrect = all(part correct)`. Choosing "all parts correct" for the boolean (rather than "score > 0" or similar) is deliberate: it's what lets `coaching_service.decide(is_correct, attempt_number)` keep working completely unchanged (§H) even for a partially-correct multi-part submission — the richer partial-credit information rides alongside in `score`/`partResults` for whichever future consumer wants it, without coaching needing to change.

**Frontend surfacing:** `MultiPartInput` (§E) renders each part via the same registry, recursively; the submission payload nests `partResponses` by `partId`; result rendering needs a genuinely new per-part feedback view, not designed pixel-by-pixel here.

**Explicitly not implemented by this document:** no code, no schema change, no re-authoring of `le-q25`/`le-q37`/`le-q40`.

---

## H. Marking model

| Real scenario | Mechanism | Status |
|---|---|---|
| 1-mark recall | `short_text`/`numeric`, `maxScore=1` (default), all-or-nothing | **Already fully supported today** |
| 2/3-mark direct question | `maxScore=2` or `3`, same evaluators | **Schema-supported today** (nothing stops authoring this now — `score` is still strictly `0` or `maxScore` since neither Slice 1 evaluator does within-answer partial matching) |
| Multi-step reasoning, one free-text answer | Future rubric/`scoreBreakdown` (§B/§C), likely AI-assisted | **Deferred, AI-adjacent** |
| Multi-part question | `multi_part` decomposition (§G), native partial credit via `partResults` | **Designed here, not built** |
| Exact answers | `short_text` | **Done** |
| Numeric tolerance | `numeric` | **Done** |

**Explicitly separate from mastery, restated:** `attempt_service`'s mastery rule (3 consecutive correct, no hints, most-recent-first, per `get_performance()`) operates purely on the `is_correct` boolean streak — nothing in this marking-model design touches it. A future, separately-scoped adaptive-learning milestone could make mastery score-aware (e.g. "3 consecutive fully-correct, ≥80% partial credit"), but that is explicitly not proposed, designed, or implemented here.

---

## I. Adaptive learning readiness

**Already preserved architecturally — verified by direct inspection this pass, not assumed:**

| Signal | Where it already lives | Populated today? |
|---|---|---|
| Objective/concept attribution | `Question.objectiveIds` (A1) | Yes, for the migrated pilot chapter |
| Question difficulty | `Question.difficulty` | Yes, always |
| Per-attempt correctness, topic, session, timestamp | `attempts` table (`topic_id`, `difficulty`, `session_id`, `session_mode`, `attempt_number`, `is_correct`, `created_at`) | Yes |
| Hint usage per attempt | `attempts.hints_used` column | **No — column exists, never populated.** Confirmed: neither `record_attempt_for_answer` nor `runtime_session_manager._record_attempt` passes it; both leave it at its `0` default. |
| Response time per attempt | `attempts.time_taken_seconds` column | **No — column exists, never populated.** Same finding as above. |
| Question type per attempt | `attempts.question_type` column | **No — but trivially populatable now** that `Question.questionType` exists (Slice 1); not done because it wasn't authorized in this milestone. |
| Topic-level mastery/accuracy/weak-spots | `learning_context_service.build_learning_context()` | Yes, already computed on every session-planning call |

**Genuinely new architecture that would need to be preserved (not implemented) for a future milestone to build on:**
- **Objective-level (not just topic-level) performance aggregation.** `learning_context_service` only aggregates by `topic_id` today; `attempts` has no `objective_id` column at all. A future additive `attempts.objective_id` column (nullable, mirroring `topic_id`'s existing pattern) is the natural preservation point — not added here, since it requires first deciding which of a question's (possibly several, via `objectiveIds`) objectives a given attempt should be attributed to, a real design question not resolved by this document.
- **Score/partial-credit history.** `attempts` stores only the `is_correct` boolean today, never `score`/`maxScore`. Once partial-credit questions exist (§G/§H), "progression over time" is poorly represented by binary correctness alone — a future additive `attempts.score`/`attempts.max_score` pair is the natural preservation point.

**Explicitly deliberately deferred — logic, not architecture:** any mastery-algorithm change, any adaptive question-selection logic, any student-capability model, any personalized-difficulty adjustment, anything beyond what `learning_context_service` already computes at topic level. None of this is designed further here (see §N).

---

## J. AI readiness

What already exists, verified, that a future AI Math Thinking Coach would need: stable `objectiveIds` (A1); `questionType`/`ResponseSpecification` (Slice 1); `EvaluationResult.evaluatorId`/`.confidence` as the seam an `AIEvaluator` would plug into (Part I §19, unchanged); and — the concrete precedent worth naming explicitly — **Shadow Mode's existing `AIEvaluation{correctness, confidence, reasoning_quality, misconception_tags, explanation}` schema**, already built (ADR-002), already running out-of-band, already shaped almost exactly like what a production AI evaluator's result would need to carry. A future AI evaluator is not starting from nothing; it has a working, tested precedent sitting adjacent to the exact seam this design already reserves.

What a future AI milestone would consume once §I's preservation points exist: per-student attempt history with real hint-usage/response-time/score data, per-objective (not just per-topic) performance, and misconception evidence (once `attempts.misconception_tag` — already a column, still unpopulated — is wired to the `misconception` content several chapters already author per question, an already-named-but-not-built connection from Part I §8).

**No speculative AI field is proposed anywhere in this section.** Every field discussed here (`evidence`, `partResults`, a future `objective_id`/`score` on `attempts`) already has a non-AI justification from §C/§G/§H/§I — nothing is proposed "because AI will eventually want it" as the sole reason.

---

## K. Teacher Content Intelligence — future outline

```
Teacher upload (worksheet / PDF / lesson content / question paper)
        ↓
AI extraction → produces CANDIDATE content in the SAME canonical shape
                this document already designs (Concepts, LearningObjectives,
                Questions, ResponseSpecifications, private answer-key entries)
                — extraction's job is to produce well-formed candidates in an
                existing format, not invent a new one
        ↓
Teacher review (UI not designed here)
        ↓
The SAME reviewStatus approval gate hand-authored content already goes
through (ADR-003) — no separate, weaker gate for AI-sourced content
        ↓
Canonical content (docs/content-source/)
        ↓
Stage 10 export (unchanged mechanism, §F)
        ↓
Runtime data
        ↓
Assignment/test — a new concept (a teacher selecting a subset of the
question bank to assign); not designed here
        ↓
Student attempts → evaluation (existing pipeline, entirely unchanged)
        ↓
Learning analytics (future, §I)
```

**Guardrail, restated as a hard rule, not redesigned:** AI-generated or teacher-uploaded content enters *only* as a candidate in the canonical layer, gated by the identical approval mechanism as hand-authored content, and **never** writes to `backend/app/data/*.json` directly. This is A1's §R guardrail, unweakened and unchanged by anything in this document.

Nothing about upload handling, extraction models, a review UI, or an `Assignment` entity is designed further here — this is a topology diagram, not an implementation plan.

---

## L. Class / subject extensibility

Audited directly against the current codebase, not assumed:

- `Chapter{id, title, description}` — plain strings; nothing prevents a chapter titled for a different class or subject today.
- **There is currently no `classLevel`/`grade`/`subject` field anywhere in the schema at all** — this is a genuine gap for future multi-class/multi-subject support, but it is a *gap*, not a *hardcoded blocker*: there's no field to migrate away from, because none exists yet. A future, additive `Chapter.classLevel`/`Chapter.subject` (or a new `Course`/`Grade` entity above `Chapter`) is low-risk to add whenever actually needed — it would default to `"Class 8"`/`"Mathematics"` for all 6 existing chapters with zero conflict.
- **The one genuine hardcoded reference found in the entire codebase:** `backend/app/experiments/ai_evaluation/../ai_evaluation_prompt.py`'s `PROMPT_TEMPLATE` opens with *"You are evaluating a Class 8 student's answer to a math question."* This is Shadow Mode's experimental, currently-unused-in-production prompt string (ADR-002) — it would need to become grade/subject-parameterized before any cross-class/cross-subject AI evaluation, but it blocks nothing today since Shadow Mode has no production influence.
- Otherwise: A1's `Concept`/`LearningObjective`/`WorkedExample` model, this document's `Question`/`ResponseSpecification`/`EvaluationResult`/evaluator-registry model, and the content pipeline are all subject/grade-neutral by construction (Part I §22's audit already established this for Slice 1; nothing added in this Part II section reintroduces a Math/Class-8 assumption, except — correctly — the `numeric` evaluator's comparison algorithm itself, which is inherently mathematical).

**No refactor is proposed** — no concrete blocker exists today that would force one. The `classLevel`/`subject` gap is named as a known, low-risk future addition, not an urgent fix.

---

## M. Roadmap

Recommended sequence, with justification for the order (not assumed):

1. **M2 Slice 1 — CLOSED.** Question & Response Semantics foundation.
2. **Next candidate: `single_choice` (structured MCQ), backend evaluator + the first, minimal frontend response component.** Justified first among the remaining types because: it's the most-requested and most concretely evidenced in real content (`le-q21`-style questions already exist, already documented as broken); its `ResponseSpecification`/private-answer shape (§B) is the simplest of the remaining types (one selected id vs. several); and it's the type that most directly validates the frontend registry pattern (§E) other types will reuse. `multi_choice` (M2 Slice 3, **implemented**) followed exactly this path — the only real question it added beyond `single_choice`'s pattern was exact-set comparison, since Slice 3's authorization resolved the partial-credit question in §B without a policy field (all-or-nothing only).
3. **`multi_part` + its marking model (§G/§H/§C's `partResults`).** Justified next, ahead of `fill_blank`/`match_following`, because it has the clearest, already-documented real-content need (`le-q25`/`le-q37`/`le-q40`) and because it's purely a *composition* of whatever single-question types already exist by then — the later it's built, the more types it can already recurse over.
4. **`fill_blank`, then `match_following`.** Lower urgency — no real content currently demonstrates a concrete need for either (unlike MCQ and multi-part), so they're ordered last among the six originally-named types pending real evidence.
5. **Richer `EvaluationResult` (the §C correction: `partResults`, `evidence`) lands together with whichever slice first needs it** (`multi_part` for `partResults`; an AI-evaluator milestone for `evidence`) — not as a standalone schema slice with no producer.

**Then, separately, as their own milestones** (each needing its own design/review/approval pass, none started by this document): Adaptive Learning Foundation (§I's preservation points activated into real logic); AI-assisted Math Thinking Coach (§J, building on Shadow Mode's precedent); Teacher Content Intelligence (§K); broader class/subject expansion (§L's additive fields, whenever a real second class or subject is actually planned).

---

## N. Scope protection

| Capability | Classification |
|---|---|
| `single_choice` evaluator + `ResponseSpecification`/answer-key shape (§B) | **IMPLEMENTED — M2 Slice 2** |
| `multi_choice` evaluator + `ResponseSpecification`/answer-key shape (§B, corrected) | **IMPLEMENTED — M2 Slice 3** |
| `multi_part` evaluator + `partResults` (§C/§G) | **IMPLEMENTED — M3, released 2026-09-16** (see closure note below; `partResults` shipped, `evidence` did not) |
| `fill_blank`/`match_following` | DESIGN NOW / IMPLEMENT LATER (lower priority, §M) |
| Frontend response-component registry (§E) | DESIGN NOW / IMPLEMENT LATER — first needed the moment `single_choice` ships |
| `EvaluationResult.evidence`/`partResults` fields | DESIGN NOW / IMPLEMENT LATER — only with a real producer |
| `attempts.objective_id`, `attempts.score`/`max_score` columns (§I) | DESIGN NOW / IMPLEMENT LATER |
| Populating `attempts.hints_used`/`.time_taken_seconds`/`.question_type` (already-existing columns) | **`hints_used`: IMPLEMENTED — released 2026-09-16** (see closure note below). `.question_type` was already populated by an earlier, undocumented Self-Serve commit (`781f87a`, predates this release). `.time_taken_seconds` remains unpopulated. This row's "not authorized by this document" is superseded for `hints_used` only; see the note. |
| Rubric-based within-answer partial credit (§B) | DESIGN NOW / IMPLEMENT LATER, explicitly AI-adjacent |
| Mastery-algorithm changes, adaptive question selection, student-capability model | **DELIBERATELY DEFER** |
| AI evaluator implementation, prompt design, model integration | **DELIBERATELY DEFER** |
| RAG, embeddings, vector database | **DELIBERATELY DEFER** — not proposed anywhere in this document |
| Teacher upload/extraction/review UI, `Assignment` entity | **DELIBERATELY DEFER** — topology only (§K) |
| `Chapter.classLevel`/`.subject` fields | **DELIBERATELY DEFER** — no current requirement forces this |
| Shadow Mode prompt generalization beyond Class 8 (§L) | **DELIBERATELY DEFER** — no production impact today |
| Any change to `coaching_service`, `answer_service`, Learning Session Engine selection logic | **DELIBERATELY DEFER** — unchanged by every option above |
| Any change to A1's `Concept`/`LearningObjective`/`WorkedExample`/`objectiveIds` model | **DELIBERATELY DEFER** — not revisited anywhere in this document |

Nothing in this document is classified **IMPLEMENT NOW** — consistent with the instruction that this is a design-only checkpoint at the time it was written. The closure note immediately below records what has since shipped.

---

### Closure note — M3 `multi_part` and telemetry, released 2026-09-16

**This section records the present, current-dated authorization for what actually shipped. It does not claim either capability was authorized at any earlier point — a 2026-09-16 release-readiness assessment found no record, in this document or anywhere else in the repository (ADR, `Backlog.md`, `Development-Journal.md`), of a prior authorization for either, despite code comments in `evaluation_service.py` referring to "the M3 implementation authorization's three decisions." That gap is neither resolved retroactively nor hidden — it's named here, and the authorization below is dated to when it was actually given.**

**M3 `multi_part` — scope, as actually implemented:**
- Exactly three questions, all already live in production: `le-q25` (LHS/RHS), `le-q37` (smaller/larger number), `le-q40` (length/breadth). No broader `multi_part` rollout is authorized by this closure — a future chapter/question wanting `multi_part` needs its own scoping decision, not an extension of this one.
- **Decision 1 (submission encoding):** `AnswerSubmission` stays the existing flat `answer: str`; both the private answer-key value and the student's submission encode ordered part answers as one `"|"`-delimited string — the same "opaque delimited string" convention `multi_choice` already established with `,`. `"|"` was chosen because it appears in none of the three questions' real part answers.
- **Decision 2 (part ordering):** parts are positional and order-fixed; no permutation/unordered-set matching.
- **Decision 3 (algebraic-part scope):** a part's `questionType` is limited to `short_text` or `numeric` — no algebra/equivalence parser. A part naming any other type fails safe to incorrect for that part.
- `isCorrect` is `True` only when every part is correct, keeping `coaching_service.decide()` unchanged; per-part detail rides in `EvaluationResult.partResults` (§C's proposed shape, now implemented) — `evidence` was not added, since it has no producer yet, per §C's own reasoning.
- Content-pipeline validation (`loadCanonical.js`) rejects a `multi_part` question whose parts aren't `short_text`/`numeric`, and rejects nesting (a part that is itself `multi_part`).

**Telemetry — `attempts.hints_used`, scope as actually implemented:**
- Real client-side hint counts now reach `attempts.hints_used` via both the anonymous (`AnswerSubmission.hintsUsed`) and session (`SubmitSessionAnswerRequest.hintsUsed`) flows — previously always `0`, regardless of actual hint usage.
- **This activates a pre-existing, previously-inert rule** in `attempt_service.get_performance` (`mastered = streak >= 3` correct answers with `hints_used == 0`). **Explicit product decision, made as part of this same 2026-09-16 release**: a correct answer given after using a hint no longer counts toward a mastery streak; a correct answer given without hints continues to. This is a real behavior change for any learner who has used hints — not merely a bug fix — and is recorded here as a deliberate, dated decision, not inferred from the code.
- A new `attempts.submitted_option_id` column was also added (write-only; no read path yet) — unrelated to the mastery rule, captured in the same release for provenance/evidence-capture purposes.

---

## O. Decisions requiring Product Architect approval

1. **Which candidate slice is actually next** — this document recommends `single_choice` (§M) as the next authorized implementation slice, but that recommendation itself needs your sign-off before any implementation begins.
2. **Whether Slice 2 (whatever it is) is allowed to touch the frontend at all**, or whether one more backend-only increment should be found first (§E) — `single_choice` as recommended is the first slice in this whole initiative that would require frontend work, a real change in kind from Slices 1's zero-frontend-risk pattern.
3. **The `EvaluationResult` restructuring proposed in §C** (`partResults` as a distinct concept from `scoreBreakdown`, plus the new `evidence` field) — a genuine critique of the shipped Slice 1 shape, not implemented, needing explicit approval before it becomes binding on whichever slice builds `multi_part`.
4. ~~`multi_choice`'s default partial-credit policy~~ — **RESOLVED by M2 Slice 3 authorization**: all-or-nothing exact-set scoring only, no `partialCreditMode` field. A future `proportional` mode, if ever wanted, is a new decision, not a pending one.
5. **Whether to populate the already-existing-but-unused `attempts.hints_used`/`.time_taken_seconds`/`.question_type` columns** as a small, low-risk, standalone slice ahead of the larger adaptive-learning work (§I/§N) — mechanical, but still needs authorization since it wasn't part of any closed slice yet.
6. **Timing of the `Chapter.classLevel`/`.subject` addition** (§L) — no current requirement forces it; worth the Product Architect flagging when it becomes live rather than leaving it perpetually deferred, same posture as Part I §27's symbolic-algebra note.
