# AI Evaluation Spike (Feature 014)

Experimental playground only. Nothing in this directory is imported by
`app/*`, wired into the FastAPI request flow, or reachable from the
production API. It exists to answer one question:

> Can a local LLM reliably evaluate Class 8 math answers, well enough to
> justify further investment (Feature 015 — Shadow Mode)?

It is a follow-on to the Feature 013 design proposal — the structured
output shape in `schema.py` mirrors that proposal's "internal evaluation
model" sketch, but nothing here changes `evaluation_service.py`,
`coaching_service.py`, `answer_service.py`, the API contract, or any
frontend code.

## Files

- `ollama_client.py` — a ~20-line HTTP wrapper around Ollama's
  `/api/generate`, using `httpx` (already a project dependency, no new
  dependency added). Deterministic generation settings
  (`temperature=0`, fixed `seed`).
- `schema.py` — `AIEvaluation`, a Pydantic model for the experimental
  structured output (`correctness`, `confidence`, `reasoning_quality`,
  `misconception_tags`, `explanation`). Separate from
  `app/schemas/answer.py`; not used by production code.
- `prompt.py` — the first-cut evaluation prompt. Not optimized.
- `dataset.json` — 30 hand-written sample student answers against the
  real 25 questions in `app/data/questions.json`, spanning five
  categories: `correct`, `arithmetic_mistake`, `conceptual_mistake`,
  `incomplete_reasoning`, `free_form_explanation`. Each sample carries
  an `expectedLabel` — a human judgment of whether the answer is
  actually correct, which is deliberately **not** the same thing as
  "does it exact-match `answer_keys.json`". A few samples exist
  specifically because rule-based exact-match gets them wrong (e.g.
  `s21`: "Trapezoid" vs. the stored "Trapezium" — a valid regional
  synonym the question's own hint acknowledges; `s06`: "4/8" for a
  question that asks to simplify — mathematically equal to the
  expected "1/2" but doesn't fulfill the instruction, marked incorrect
  on purpose as a partial-credit edge case).
- `run_harness.py` — the standalone harness. Loads
  `app/data/questions.json` and `app/data/answer_keys.json` read-only
  (no writes to production data), loads `dataset.json`, calls the
  model once per sample, parses/validates the response, prints a
  summary, and writes raw results to `results/run_<timestamp>.json`.
- `results/` — captured run output (see below).

## Running it

```bash
cd backend/experiments/ai_evaluation
../../.venv/Scripts/python.exe run_harness.py
```

Requires a local Ollama server running (`ollama serve`, or the Ollama
app) with the model pulled (`ollama pull qwen2.5:7b-instruct`).

## Model used

**Qwen2.5 7B Instruct** (`qwen2.5:7b-instruct` in Ollama), per Feature
013's recommendation — chosen over a plain `llama3.1`/`mistral` baseline
for its stronger math-reasoning benchmarks at this parameter count,
which matters most for the harder capabilities on the roadmap
(reasoning-quality and misconception detection), not just correctness
checking. No newer Qwen release was substituted; `qwen2.5:7b-instruct`
was current and stable in Ollama's library at the time of this spike.

Only this one model was benchmarked, per scope — no multi-model
comparison in this feature.

## Ollama version

`0.9.0` (`ollama --version`).

## Hardware

- CPU: Intel Core i3-1215U (6 cores / 8 logical processors)
- RAM: 16 GB
- GPU: Intel UHD Graphics (integrated, no dedicated GPU) — inference ran
  CPU-only
- OS: Windows 11 Home Single Language

This is a modest laptop, not a GPU workstation or server — the latency
numbers below should be read as a lower bound for what a school-grade
deployment target might look like, not a best case.

## Results

Full run: `results/run_20260722T144448Z.json` (30/30 samples, raw
prompts excluded — only responses are captured — see that file for
every question/answer/response triple).

- **JSON parse success: 30/30 (100%)**
- **Schema valid (matches `AIEvaluation`): 30/30 (100%)**
- **Correctness agreement with `expectedLabel`: 28/30 (93%)**
- **Latency:** mean 39.3s, median 38.7s, min 34.2s, max 57.7s (first
  call, likely cold-start) — CPU-only, no GPU
- **Confidence:** mean 0.98, min 0.85, max 1.00 — see "Confidence is
  not well-calibrated" below

By category (agreement / total): `arithmetic_mistake` 4/4,
`conceptual_mistake` 6/6, `correct` 11/12, `free_form_explanation`
4/5, `incomplete_reasoning` 3/3.

**The two disagreements, examined individually** (both worth reading —
neither is a simple "model was wrong"):

- **s22** (`q5-understanding-quadrilaterals`, "What makes a square
  different from a rectangle?", student answer "All four sides are
  equal", `expectedLabel: true`): the model marked this **incorrect**,
  reasoning that it "only mentions a property of squares, not the
  differences between squares and rectangles." That's a defensible,
  arguably more pedagogically rigorous reading of the question than
  the ground-truth label used here — a genuine case where the single
  human-set `expectedLabel` may itself have been too lenient, not
  necessarily a model error.
- **s26** (`q5-practical-geometry`, "how do you start drawing a circle
  of radius 3cm", student answer describing setting the compass to 3cm
  "using a ruler," `expectedLabel: true`): the model marked this
  **incorrect**, objecting that "the student unnecessarily uses a
  ruler to set the compass, which is not required." This looks like a
  genuine model overreach — using a ruler to set a compass to a precise
  width is standard, correct practice — and is the one case in this
  run that looks like a real evaluation error rather than a debatable
  ground-truth label.

**Confidence is not well-calibrated in this run.** Reported confidence
clustered at three values (0.85, 0.95, 1.00) across all 30 samples, and
both disagreements were reported at 0.95 — statistically
indistinguishable from many correct judgments also reported at 0.95.
Feature 013's confidence-gated fallback strategy assumes confidence can
separate trustworthy from untrustworthy judgments; on this small sample,
it doesn't. This needs real investigation (larger sample, possibly a
different confidence-elicitation approach) before Feature 016 could
rely on it as designed.

**Misconception tags are not a controlled vocabulary today.** The model
freely invented tag strings per sample (`incorrect_addition_of_fractions`,
`confusion_with_symbol`, `incorrect_solution` vs. `incorrect solution`
— inconsistent underscore/space formatting even within this one run).
Feature 013 anticipated this and called for a controlled vocabulary;
this run confirms that requirement is not optional — it won't emerge
from the model on its own.

## Known limitations of this spike

## Known limitations of this spike

- 30 hand-picked samples is enough to exercise different answer types,
  not enough to produce statistically reliable accuracy figures — a
  directional signal, not a benchmark.
- Only one model was tried; no prompt tuning was attempted.
- `expectedLabel` was set by a single reviewer's judgment (this
  session), not cross-checked by a second person or a teacher — a
  reasonable proxy for a spike, not a validated gold-label set.
- The harness measures wall-clock latency for a single sequential run;
  it does not simulate concurrent requests, which is a materially
  different (and important) latency question for a real classroom
  deployment.
