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
