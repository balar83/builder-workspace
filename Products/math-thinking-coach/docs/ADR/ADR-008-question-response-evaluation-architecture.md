# ADR-008: Question/Response Evaluation Architecture (M2.1–M2.4)

**Status:** Accepted
**Date:** 2026-08-19

---

## Context

Before M2, the system had exactly one question type, unnamed: a prompt string, answered with one free-text string, checked with exact-string equality (`evaluation_service.evaluate()` was four lines — look up the expected answer, `submission.answer.strip() == expected_answer.strip()`, return binary). This wasn't a simplified version of a richer model; there was no richer model anywhere in the stack. Content already disagreed with this shape: `le-q21`-style multiple-choice questions were miscast as free text with a full-sentence expected answer (`"(b) 2x + 5 = 11. It has exactly one variable..."`), and several questions packed two or more independent values into one string. This was a known, documented limitation (`Phase-1-Handoff.md` §12.1/§13.5), not a new discovery.

M2.1–M2.3 (`e41670a`/`87e8414`/`e120a1d`, 2026-08-17) built the capability to represent and evaluate more than one question shape. M2.4 (`2e0205d`, 2026-08-17) then activated it against real content for the first time, in Linear Equations — see `Development-Journal.md`'s 2026-08-17 entries and `Question-Response-Semantics-Design-Proposal.md` (Parts I and II) for the full design record. No ADR existed for the architecture itself; this ADR closes that gap.

## Problem Statement

Given a system with exactly one implicit question type, how do you introduce genuine type diversity (a question with selectable options, a question with a numeric answer accepted in multiple equivalent forms, a question with several correct options) such that:

- The question schema, the evaluation logic, the content pipeline, and the frontend input widget all agree on what a given question's response contract *is*, with no single one of them free to drift from the others.
- Adding a new type is additive — no existing question, evaluator, or caller changes behavior by default.
- The correct-answer boundary established by [ADR-001](ADR-001-evaluation-coaching-separation.md) (expected answers never leave the private `answer_keys.json` path) holds for every type, including ones whose "options" are legitimately public.
- Evaluation logic doesn't degrade into an `if questionType == ... elif questionType == ...` ladder spreading across services as types are added.
- A type can be *named and reserved* in the schema before it has an evaluator, so canonical content is never retrofitted a second time.

## Decision

**A capability — "how is this question's response represented and evaluated" — is represented once, consistently, at each of four points, and the same capability identifier (`questionType`) is what ties them together:**

1. **Schema** (`Question.questionType` + `Question.responseSpecification`) states the contract: what shape the response takes, and what parameters (if any) the evaluator needs.
2. **Evaluator** (a plain function conforming to a shared signature) interprets a submission against that contract and produces a shared `EvaluationResult` shape.
3. **Registry/dispatch** (`_EVALUATORS`, a `dict[QuestionType, Evaluator]` in `evaluation_service.py`) selects the evaluator for a given `questionType` — the single dispatch point in the system; no second branch on `questionType` exists or should exist anywhere else in the backend.
4. **Pipeline** (Stage 10's `loadCanonical.js`/`transform.js`) validates that canonical content's `questionType` is structurally well-formed and, critically, **rejects any question naming a reserved-but-unimplemented type** — a type can be named in the schema (`QuestionType`'s `Literal` union) years before it has an evaluator, without canonical content being able to accidentally author content for it.
5. **Frontend** (`QuestionResponseInput`, a dispatch component) selects the response widget (`SingleChoiceInput`, `MultiChoiceInput`, or the pre-existing free-text `AnswerInput`) the same way the backend selects an evaluator — one dispatch point, not per-page branching. Neither `QuestionPage` nor `SessionQuestionPage` branches on `questionType` directly.

This is a **technical mechanism** — it says nothing about which chapters' content actually uses which type. That's a separate, deliberate product-policy decision, the **Activation Gate**: a capability slice (implementing an evaluator/schema/pipeline/UI path end to end) and an activation slice (converting real content to use it) are tracked and authorized independently, and no new question type is authorized while an already-implemented type has zero real content using it. M2.1–M2.3 was a pure capability slice — repository inspection at the M2.4 authorization checkpoint confirmed all 241 then-existing questions still defaulted to `short_text`, including M2.1's own Definition-of-Done item requiring a real `numeric` pilot, which had never been ticked. M2.4 was the activation slice that closed that gap. The registry architecture this ADR documents is what the Activation Gate is a policy *about* — the gate governs when a type's dispatch path may be exercised, not how the dispatch path itself works.

## Architecture

```
Question.questionType: "short_text" | "numeric" | "single_choice" | "multi_choice"
                          | "fill_blank" | "matching" | "multi_part"   (reserved)
Question.responseSpecification: ResponseSpecification | None
    numericTolerance: float = 0.0          (read by the "numeric" evaluator)
    options: list[Option] | None           (read by "single_choice"/"multi_choice";
                                             public text, never the correct id)

                    ┌─────────────────────────────────────────────┐
canonical content ─→│  Stage 10: loadCanonical.js / transform.js   │─→ backend/app/data/*.json
(docs/content-       │  structurally validates questionType;        │   (questions.json,
 source/<ch>/         │  REJECTS reserved-but-unimplemented types    │    answer_keys.json)
 stage6-questions)    │  at export time, not silently                │
                    └─────────────────────────────────────────────┘

GET /chapters/{id}/questions ──→ Question (public: prompt, options' text — never
                                   the correct option id or numeric answer)

POST /questions/{id}/answer  ┐
POST /sessions/{id}/answer   ┴──→ answer_service.evaluate_answer()
                                       │
                                       ▼
                              evaluation_service.evaluate(question, submission)
                                       │  evaluator = _EVALUATORS[question.questionType]
                                       │  (the one dispatch point — ADR's core claim)
                                       ▼
                              evaluator(question, submission) → EvaluationResult
                                  {isCorrect, score, maxScore, evaluatorId, ...}
                                       │
                                       ▼
                              coaching_service.decide()  (ADR-001, unchanged — consumes
                                                            only isCorrect/attemptNumber)

frontend: <QuestionResponseInput questionType=... responseSpecification=...>
              dispatches to SingleChoiceInput | MultiChoiceInput | AnswerInput
          (QuestionPage, SessionQuestionPage — neither branches on questionType itself)
```

**Evaluators shipped** (`evaluation_service.py`, `_EVALUATORS` registry): `short_text_v1` (behavior-preserving extraction of the pre-M2 exact-match logic — provably identical for all pre-M2 content), `numeric_tolerance_v1` (`Fraction`-based exact rational comparison; `1/2` and `0.5` compare equal; `numericTolerance` widens this to an approximate band only when a question opts in), `single_choice_v1` (submitted option id vs. private correct id), `multi_choice_v1` (exact-set comparison, order-independent, all-or-nothing — no partial-credit policy field). Each evaluator id carries an explicit `_v1` version suffix, a deliberate naming convention (`Question-Response-Semantics-Design-Proposal.md` §27 item 3) so a future evaluator revision for the same `questionType` can ship as `_v2` without ambiguity about which logic actually scored a given `EvaluationResult`.

**The private-answer boundary holds uniformly.** For every `questionType`, including `single_choice`/`multi_choice` where the *options'* text is legitimately public, the correct answer is resolved only through `evaluation_service.get_expected_answer()` reading the private `answer_keys.json` — never a second, type-specific answer-key mechanism. This is ADR-001's boundary, extended, not reopened.

**Registration is unavoidable, not disciplined.** `evaluate()` raises `ValueError` for any `questionType` with no registered evaluator, rather than guessing or silently no-oping — this should be unreachable in production (Stage 10 already refuses to export a reserved-but-unimplemented type), but the raise makes that invariant loud rather than assumed.

## Alternatives Considered

- **Branching on `questionType` at each call site vs. one registry dispatch.** Chose the registry (a `dict[QuestionType, Evaluator]`, not an `if`/`elif` ladder) specifically so `answer_service`, `runtime_session_manager`, and Shadow Mode all see only the `EvaluationResult` an evaluator produces, never `questionType` itself — adding a type never touches any of those callers.
- **Frontend per-page branching vs. a dispatch component.** Chose `QuestionResponseInput` as a single dispatch point, mirroring the backend registry pattern, so `QuestionPage` and `SessionQuestionPage` — the system's two independent practice flows (`Phase-1-Handoff.md` §12.2) — don't each need their own `questionType` branch to keep in sync.
- **A generic answer-key mechanism per type vs. one path for all types.** Chose to keep every type's correct answer resolved through the single existing `get_expected_answer()` path (for `single_choice`/`multi_choice`, the private value is simply the correct option id(s), not a second key format) — avoids a second boundary to keep secure as ADR-001's guarantee extends to new types.
- **`multi_choice` submission representation: a new list-typed field on `AnswerSubmission` vs. reusing the existing `answer: str` field with a comma-delimited convention.** Chose to reuse the string field — every `questionType`'s submission is uniformly a string at the API boundary regardless of how many values it logically carries, so no `questionType`-specific request shape exists anywhere in the contract. This is a narrower, implementation-level decision than the four-point architecture above, not elevated to its own numbered point in the Decision section, but named here because it is a real, durable choice with a consequence (see below), not an incidental default.
- **Reserving all seven types in the schema now vs. adding each type's name only when its evaluator ships.** Chose to name the full durable taxonomy (`fill_blank`, `matching`, `multi_part` included) in `QuestionType`'s `Literal` union from Slice 1, with Stage 10 rejecting canonical content for the unimplemented ones — lets future content be authored correctly from day one instead of retrofitted, at the cost of the schema listing types with no evaluator yet.

## Trade-offs

**Pros**
- Adding a type (as M2.2/M2.3 each did) touches exactly one new evaluator function, one registry entry, one Stage 10 validation branch, and one frontend component — no existing type's code path changes, confirmed each time by full-suite regression (267/267 backend, 134/134 frontend, 88/88 Stage 10 pipeline at M2.4's close).
- The capability/activation split (the Activation Gate) means a type can be built, tested, and verified against synthetic cases (M2.1–M2.3) before any real content risk is taken, and real-content activation (M2.4) can be scoped, reviewed, and rolled out as its own small slice.
- `short_text_v1`'s extraction was provably behavior-identical — every one of the 241 pre-M2 questions produces the same `isCorrect`/`score` for the same submissions before and after M2.1, a real regression guarantee, not an assumption.
- The private-answer boundary (ADR-001) required zero special-casing to extend to `single_choice`/`multi_choice` — the existing `get_expected_answer()` path already generalized.

**Cons**
- `EvaluationResult.confidence`/`.scoreBreakdown` exist with no producer yet (seams only) — every deterministic evaluator built so far leaves `confidence: None` rather than fabricating `1.0`, a deliberate rule (`Question-Response-Semantics-Design-Proposal.md` §8, Architectural Question K) but a real asymmetry with a future AI evaluator that would populate it.
- `multi_choice`'s comma-delimited string convention is not self-describing at the type level — nothing in `AnswerSubmission`'s schema states that a `multi_choice` answer is a delimited list; that knowledge lives only in the evaluator and the design document. Acceptable at four implemented types; would need revisiting if a fifth type needed a structurally different multi-value representation.
- The registry is a plain `dict`, not enforced by a `Protocol`/ABC at the type-checker level in this codebase's current form — a malformed evaluator function would only fail at call time, not at edit time. Matches this project's established plain-function-module convention (`Phase-1-Handoff.md` §16) rather than introducing classes solely for this.
- `fill_blank`/`matching`/`multi_part` are reserved names with no evaluator — Stage 10 actively rejects content for them, so this is an honest "not built yet," not a silent gap, but it means the schema documents more than the system currently does.

## Consequences

- **The Activation Gate is now an explicit, named product policy**, not just an M2.4 retrospective observation: no future question type is authorized for implementation while an already-implemented type (per this ADR's four-point architecture) has zero real content using it. This governs sequencing (`Backlog.md`'s "Recommended Next" item 7, M3 `multi_part`), not the architecture itself.
- Every future question type (`multi_part` next, per `Question-Response-Semantics-Design-Proposal.md` §M) is expected to follow the same four-point shape: schema addition (`ResponseSpecification` extension or a new field), one evaluator function, one registry entry, one Stage 10 validation branch, one frontend component — this ADR is the reference for that shape, so a future implementer doesn't have to re-derive it from the M2.1–M2.4 diffs.
- `evaluation_service.py` is now the sole file where `questionType`-specific evaluation logic may live; `answer_service.py` and `coaching_service.py` remain confirmed untouched by M2.1–M2.4 (empty diff beyond call-site type updates), and any future PR that adds a `questionType` branch outside `evaluation_service.py`'s registry should be treated as a violation of this ADR's core decision, not a stylistic choice.
- Stage 10's reserved-type rejection means the schema and the pipeline can drift apart only in one direction (schema ahead of pipeline, never the reverse) — a type can be named before it's implementable, but content can never be authored for a type the evaluator layer doesn't yet support.

## Future Evolution

Only what M2.1–M2.4's own implementation record already named, not new proposals:

- **`multi_part` + `partResults`** — the next type in `Question-Response-Semantics-Design-Proposal.md` §M's recommended sequence, targeting the `le-q25`/`le-q37`/`le-q40`-style compound-answer questions named in that document's §1/§12. Not authorized to start (`Backlog.md`'s "Recommended Next" item 7).
- **`fill_blank`/`match_following`** — reserved, no real content currently demonstrates a concrete need for either (§M item 4).
- **`EvaluationResult.confidence`/`.scoreBreakdown`** — reserved fields with no producer; would be populated by a future AI evaluator or a `multi_part` partial-credit evaluator respectively, not by any type shipped so far.
- **Attempt telemetry** — `attempts.hints_used`/`.time_taken_seconds`/`.question_type` are already-existing-but-unused SQLite columns (`Question-Response-Semantics-Design-Proposal.md` Part II §O.5); populating them is named as a small, mechanical, separately-authorized slice, not part of this ADR's scope.
- **Misconception-tag population** — `misconception.commonWrongOptionId` (added in M2.4 for converted Linear Equations questions) is canonical-only today; `transform.js`'s whitelist never emits it to runtime data. A future evaluator or coaching-service change that surfaces it live is unbuilt and unscoped.

## Related ADRs

- [ADR-001](ADR-001-evaluation-coaching-separation.md) — the private-answer-keys boundary (`get_expected_answer()`) this ADR's registry extends to every `questionType`, and the evaluation/coaching seam (`coaching_service.decide()`) left completely unchanged by M2.1–M2.4.
- [ADR-003](ADR-003-content-authoring-and-export-pipeline.md) — the Stage 10 pipeline this ADR's structural validation (reserved-type rejection) extends; `loadCanonical.js`/`transform.js` gained `questionType` awareness without a new pipeline stage.
- [ADR-006](ADR-006-learning-session-planning-architecture.md) / [ADR-007](ADR-007-learning-session-runtime-architecture.md) — `runtime_session_manager.submit_answer()` calls `evaluation_service.evaluate()` exactly as the standalone `/answer` route does; neither the Learning Session Engine's planning nor runtime layer was touched by M2.1–M2.4, confirmed by empty diff.

## Implementation Impact

**Backend** — New: none (no new files) at the schema/service level beyond additive fields; `evaluation_service.py` gained four evaluator functions and the `_EVALUATORS` registry, replacing its previous four-line body. Modified: `app/schemas/{question,answer,session}.py` (`questionType`, `responseSpecification`, `EvaluationResult`), `app/services/shadow_evaluation_service.py` (call-site type updates only).

**Pipeline** — `docs/content-pipeline/export/{loadCanonical.js,transform.js,run.js}` gained `questionType` structural validation and reserved-type rejection; new test files `tests/{questionSemantics,singleChoice,multiChoice}.test.js`.

**Frontend** — New: `components/QuestionResponseInput.tsx` (dispatch), `components/SingleChoiceInput.{tsx,css}`, `components/MultiChoiceInput.tsx`. Modified: `pages/{QuestionPage,SessionQuestionPage}.tsx` (render through the dispatch component instead of always rendering the free-text input), `types/{question,session}.ts`.

**API** — Additive only. `Question`'s public shape gained `questionType`/`responseSpecification`/`maxScore`; no existing field's meaning changed. No route's URL or method changed.

**Content** — M2.1–M2.3 migrated zero questions (capability only). M2.4 converted 33 of Linear Equations' 44 questions (3 `single_choice`, 2 `multi_choice`, 28 `numeric`); 11 remain `short_text` by deliberate choice (compound/multi-value answers, the documented `multi_part` targets). The Squares & Cubes content import (`a071335`, 2026-08-19) added 12 new questions to that chapter, unrelated to this ADR's architecture.

**Tests** — 267/267 backend, 134/134 frontend, 88/88 Stage 10 pipeline passing at M2.4's close (up from 205/112/– at M2's start — see `Development-Journal.md`'s 2026-08-17 entries for the per-slice progression).
