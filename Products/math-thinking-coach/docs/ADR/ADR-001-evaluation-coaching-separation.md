# ADR-001: Separate Evaluation from Coaching Behind a Service-Layer Seam

**Status:** Accepted
**Date:** 2026-07-15 (Feature 012, implementation) — validated 2026-07-22 (Feature 014, AI evaluation spike)

---

## Problem

`answer_service.evaluate_answer` originally did two structurally different jobs in one function: deciding whether a submitted answer is *correct* (a factual check against `answer_keys.json`), and deciding what to *do* about it — which coaching message to show, whether to nudge a hint, when to suggest the solution, based on attempt number. Rule-based exact-match was known from the start to be a temporary Phase-1 answer for correctness-checking; an AI-based evaluator was always the intended eventual replacement (see `ProductArchitecture.md` §7, "the extension point for future AI-based evaluation"). Leaving both jobs in one function meant that extension point didn't actually exist — replacing correctness-checking would have meant touching the same code that decides coaching behavior.

---

## Options Considered

1. **Leave `evaluate_answer` as a single function**, and have a future AI-evaluation feature edit it in place when the time comes.
2. **Split into two collaborators** — `evaluation_service.evaluate(question, submission) -> Evaluation` (correctness only) and `coaching_service.decide(is_correct, attempt_number) -> (Coach, UiState)` (coaching only) — with `answer_service.evaluate_answer` reduced to a thin orchestrator that calls both and assembles the existing response.
3. **Build a general-purpose evaluator plugin/strategy framework** (interface, registry, factory, config-driven selection) so multiple evaluation strategies could be swapped at runtime.

---

## Decision

**Chosen option: 2.**

`evaluation_service.py` and `coaching_service.py` were added as plain function modules; `answer_service.evaluate_answer` now only resolves the `Question`, calls `evaluation_service.evaluate`, calls `coaching_service.decide`, and assembles `AnswerEvaluationResponse`. `POST /api/v1/questions/{questionId}/answer`'s request/response contract is byte-for-byte unchanged, verified by the pre-existing `test_answers.py` suite passing with no assertion changes, plus a live smoke test.

Option 3 was explicitly rejected at design time: exactly one evaluation strategy existed then (rule-based exact-match), and building selection infrastructure for a second one that didn't exist yet would have been speculative, per `ENGINEERING_PRINCIPLES.md`'s "reuse through need."

---

## Trade-offs

**Pros**

- Correctness-checking can now be replaced (rule-based → AI-based) without touching coaching logic, and vice versa.
- `evaluation_service.evaluate` takes the full `Question` object, not just `question_id` — a deliberate, low-cost hedge, since a future free-form-answer evaluator will almost certainly need `question.question`/`hints`/`solution` as grounding context. Widening a narrower signature later would have been a second breaking change.
- No route, schema, or frontend changes were required — the seam is entirely internal.
- Directly validated one week later: the Feature 014 spike built a complete, independent AI evaluator (`backend/experiments/ai_evaluation/`) against this exact seam's shape, without touching `evaluation_service.py`, `coaching_service.py`, or `answer_service.py` at all.

**Cons**

- Two small modules instead of one — a marginal increase in files to navigate for a change this small.
- No strategy-selection mechanism exists yet. When a second real evaluation strategy is ready to ship (e.g., Shadow Mode, Feature 015), something will need to decide which evaluator runs — not yet designed, deliberately (see Future Evolution).

---

## Future Evolution

This seam is built to let `evaluation_service.evaluate` be replaced or supplemented without changing `coaching_service.py`, the API contract, or the frontend:

- **Feature 015 (Shadow Mode, near-term, see `Roadmap.md`)**: would call an AI evaluator alongside `evaluation_service.evaluate` and log both, without either touching `coaching_service.py` or changing what's returned to the client.
- **A live AI-based evaluator (medium-term)**: would replace or gate the call inside `answer_service.evaluate_answer`, not restructure it. Coaching logic is unaffected either way, since it only ever sees an `is_correct` boolean and an attempt number, never how correctness was determined.
- If a second evaluation strategy is ever needed *concurrently* (not just as a staged replacement), option 3's strategy-selection question becomes real and should get its own ADR then — not before.

---

## Impact

**Frontend** — None. No route, schema, or component changed.

**Backend** — `answer_service.py` reduced to an orchestrator; `evaluation_service.py` and `coaching_service.py` added as the two collaborators.

**API** — None. `POST /api/v1/questions/{questionId}/answer` contract unchanged.

**Tests** — `test_answers.py` (11 tests) passing unmodified is the regression proof the refactor is behavior-preserving. 9 new focused unit tests added: `test_evaluation_service.py` (correct, incorrect, whitespace-trimmed, empty) and `test_coaching_service.py` (correct → `NEXT_QUESTION`; attempts 1/2/3+ → `TRY_AGAIN`/`SHOW_HINT`/`SHOW_SOLUTION`).

**Documentation** — `Development-Journal.md` (2026-07-22 entry), `Backlog.md` (Feature 012 entry), `ProductArchitecture.md` §7 (extension-point note). This ADR backfills the formal record that was missing until this sprint.

---

## Related Documents

- `Products/math-thinking-coach/docs/Development-Journal.md` (2026-07-22 entries)
- `Products/math-thinking-coach/docs/Backlog.md` (Feature 012, Feature 014, Feature 015 recommendation)
- `Products/math-thinking-coach/docs/ProductArchitecture.md` §7, §11
- `Products/math-thinking-coach/backend/experiments/ai_evaluation/README.md` (Feature 014 — the validation of this seam)
- `Products/math-thinking-coach/docs/Roadmap.md` (near/medium-term items that depend on this seam)
