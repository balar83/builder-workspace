# ADR-002: Shadow Mode — Execution Model, Logging, and the Expected-Answer Access Path

**Status:** Accepted
**Date:** 2026-07-23

---

## Problem

Feature 014 validated that a local LLM could plausibly evaluate student answers, but only against 30 hand-picked samples run through a standalone harness. Deciding whether to build a confidence-gated live evaluator (a future, not-yet-numbered feature) needs a much larger sample of real evaluations — meaning the AI evaluator now had to run against real request traffic without being trusted with any user-facing effect. That required deciding, for the first time in this codebase: how experimental code gets invoked from inside the production request path without materially changing that path's latency, reliability, or contract; where the resulting data gets stored, given no persistence layer exists; and where the AI evaluator sources the same canonical expected answer that rule-based evaluation and the Feature 014 harness both used, without creating a second reader of `answer_keys.json` or silently redefining "expected answer" as `Question.solution`.

---

## Options Considered

**Execution model**
1. Inline synchronous call inside the request path.
2. In-process background task (FastAPI `BackgroundTasks`), dispatched after the response is built.
3. External async worker (task queue + broker, e.g. Celery/RQ).

**Logging**
1. SQLite.
2. JSONL, one record per line, file-based.
3. No persistence — log lines only.

**Code lifecycle (reusing Feature 014)**
1. Leave Feature 014 entirely in `backend/experiments/`, call it from there.
2. Promote the minimum needed (Ollama client, schema, prompt) into `app/services/`, adding only timeout/error handling; leave the experiment directory as-is.
3. Fully graduate Feature 014 into a peer of `evaluation_service.py`.

**Expected-answer sourcing** (resolved mid-implementation, once the AI evaluator needed a real value to call with)
1. Read `answer_keys.json` again, directly, from the new AI evaluation code.
2. Substitute `Question.solution` — the only answer-shaped field already on the public `Question` model.
3. Add a minimal accessor on `evaluation_service.py` — the module that already owns `answer_keys.json` — and have the AI evaluation path call through it.

---

## Decision

**Execution model — Option 2.** `app/api/routes/answers.py` builds and returns the normal rule-based response exactly as before, then calls `background_tasks.add_task(shadow_evaluation_service.run_shadow_evaluation, ...)`. No new dependency, no new infrastructure; the user-facing response time and shape are unaffected — verified by `test_response_is_unaffected_when_shadow_evaluation_fails`, which forces the shadow call to raise and asserts the response is still byte-identical to the pre-Shadow-Mode contract.

**Logging — Option 2 (JSONL).** `app/services/shadow_log_writer.py` appends one JSON object per line to a path controlled by `SHADOW_LOG_PATH` (default `app/data/shadow_log/shadow_eval_log.jsonl`), gitignored. A `threading.Lock` guards concurrent appends — verified by `test_concurrent_appends_produce_non_corrupted_lines`.

**Code lifecycle — Option 2 (partial promotion).** `app/services/ai_evaluation_client.py`, `ai_evaluation_prompt.py`, `app/schemas/ai_evaluation.py`, and `app/services/ai_evaluation_service.py` are new, production-callable modules adapted from `backend/experiments/ai_evaluation/`, adding explicit timeout handling (`SHADOW_TIMEOUT_SECONDS`, default 90s) and error classification (`timeout` / `connection_error` / `json_parse_failed` / `schema_invalid`) that the spike didn't need. `backend/experiments/ai_evaluation/` itself is untouched and remains the offline harness for dataset/prompt iteration.

**Expected-answer sourcing — Option 3.** `evaluation_service.py` gained one new public function:

```python
def get_expected_answer(question_id: str) -> str:
    """
    Returns the canonical expected answer for a question, used by both
    rule-based evaluation and Shadow Mode AI evaluation.

    Raises KeyError if the question does not exist.
    """
    return _answer_keys[question_id]
```

`evaluate()` was refactored to call this accessor internally instead of indexing `_answer_keys` directly, so the docstring's "used by both" claim is true in the call graph, not just in the comment. `shadow_evaluation_service.py` calls the same accessor. `_answer_keys` stays private, with exactly one loader, in exactly one file.

**Operational kill switch** (added after the gap was explicitly raised during review, not part of the original design pass): `settings.shadow_mode_enabled` (env `SHADOW_MODE_ENABLED`, default `True`) guards the `add_task` call in `answers.py`. When `False`, the shadow evaluator is never invoked and nothing is logged — verified by `test_disabling_shadow_mode_skips_the_background_task_entirely`.

---

## Trade-offs

**Pros**
- Zero new infrastructure — no broker, no worker process, no database.
- The production response contract is provably unaffected: the test suite includes an explicit adversarial case (`generate` raising `RuntimeError`) proving a failure in the shadow path can't leak into the response.
- Exactly one reader of `answer_keys.json` remains, preserving the single-source-of-truth property Feature 010/012 established.
- Fully reversible in production without a deploy: `SHADOW_MODE_ENABLED=false`.

**Cons**
- `BackgroundTasks` is in-process: a server restart between response and task completion silently loses that one shadow evaluation. Accepted — Shadow Mode's own premise (`Backlog.md`) is "zero behavior change, all risk contained to logging," so losing an occasional log line isn't a reliability requirement.
- This execution model has a ceiling: at ~39s mean latency per call (Feature 014), meaningful concurrent traffic would queue background tasks faster than they drain. Not a problem at current traffic, but real — the reason Option 3 (external worker) was deliberately not chosen preemptively.
- JSONL has no query capability — reading it back requires a script, not a query. Acceptable today because the only consumer is a human doing the same kind of manual review Feature 014's results already required.

---

## Future Evolution

If confidence-gated live evaluation proceeds (not yet scoped or numbered — see `Backlog.md`), it replaces or gates the call inside `answer_service.evaluate_answer` — the seam ADR-001 built — not this shadow path, which stays a permanent, always-available (if enabled) comparison signal. If traffic volume ever makes the in-process background-task model insufficient, that's a new decision (Option 3, task queue) deserving its own ADR, not a silent evolution of this one. If the JSONL log ever needs to be queried rather than read wholesale, that migration (e.g., to SQLite) should be driven by an actual reporting requirement, not anticipated here.

The broader lesson this sequencing reflects: experimental AI capabilities should be integrated as observational infrastructure before they're trusted as decision-making infrastructure — Feature 015 is that step for evaluation, and confidence-gated live evaluation, whenever it's scoped, should build on what it measures, not skip past it.

---

## Impact

**Frontend** — None.

**Backend** — New: `app/services/ai_evaluation_client.py`, `ai_evaluation_prompt.py`, `ai_evaluation_service.py`, `shadow_evaluation_service.py`, `shadow_log_writer.py`, `app/schemas/ai_evaluation.py`. Modified: `app/services/evaluation_service.py` (new accessor; `evaluate()` refactored to use it), `app/api/routes/answers.py` (background dispatch behind the kill switch), `app/core/config.py` (five new `shadow_*` settings), `.gitignore` (shadow log directory).

**API** — None. `POST /api/v1/questions/{questionId}/answer` contract unchanged, confirmed by the pre-existing exact-body-equality tests passing unmodified.

**Tests** — 60/60 backend tests passing (47 before this feature; +13).

**Documentation** — This ADR; `Development-Journal.md`, `Backlog.md`, `PROJECT_STATUS.md`, `Roadmap.md`, `Product-Vision.md`, `ProductArchitecture.md` (2026-07-23 documentation slice).

---

## Related Documents

- [`ADR-001-evaluation-coaching-separation.md`](ADR-001-evaluation-coaching-separation.md) — the seam this feature calls into (via `get_expected_answer`) without touching (`coaching_service.py`, `answer_service.py` both untouched).
- `Products/math-thinking-coach/backend/experiments/ai_evaluation/README.md` — Feature 014, the source of the promoted code and the 30-sample baseline this feature exists to grow past.
- `Products/math-thinking-coach/docs/Roadmap.md` — near/medium-term sequencing this unblocks.
- `Products/math-thinking-coach/docs/Backlog.md` — Feature 015 entry.
