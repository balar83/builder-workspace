"""Standalone evaluation harness for the AI evaluation spike.

Run directly from the backend/experiments/ai_evaluation directory, e.g.:
    ../../.venv/Scripts/python.exe run_harness.py

Not a web API, not part of FastAPI, not imported by app.*. A developer
tool only, for answering one question: can a local LLM reliably judge
student math answers.
"""

import json
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

from ollama_client import generate
from prompt import build_prompt
from schema import AIEvaluation

EXPERIMENT_DIR = Path(__file__).resolve().parent
DATA_DIR = EXPERIMENT_DIR.parent.parent / "app" / "data"
RESULTS_DIR = EXPERIMENT_DIR / "results"

MODEL = "qwen2.5:7b-instruct"


def load_questions() -> dict[str, dict]:
    questions = json.loads((DATA_DIR / "questions.json").read_text(encoding="utf-8"))
    return {question["id"]: question for question in questions}


def load_answer_keys() -> dict[str, str]:
    return json.loads((DATA_DIR / "answer_keys.json").read_text(encoding="utf-8"))


def load_dataset() -> list[dict]:
    return json.loads((EXPERIMENT_DIR / "dataset.json").read_text(encoding="utf-8"))


def run() -> None:
    questions = load_questions()
    answer_keys = load_answer_keys()
    dataset = load_dataset()

    results = []

    for sample in dataset:
        question = questions[sample["questionId"]]
        expected_answer = answer_keys[sample["questionId"]]
        prompt = build_prompt(
            question=question["question"],
            expected_answer=expected_answer,
            student_answer=sample["studentAnswer"],
        )

        start = time.monotonic()
        error = None
        raw_text = None

        try:
            envelope = generate(MODEL, prompt)
            raw_text = envelope.get("response", "")
        except Exception as exc:  # noqa: BLE001 - network/model failures are part of what we're measuring
            error = str(exc)

        latency_seconds = time.monotonic() - start

        parsed = None
        json_parse_success = False
        if raw_text is not None:
            try:
                parsed = json.loads(raw_text)
                json_parse_success = True
            except json.JSONDecodeError:
                pass

        ai_evaluation = None
        schema_valid = False
        if parsed is not None:
            try:
                ai_evaluation = AIEvaluation(**parsed)
                schema_valid = True
            except ValidationError:
                pass

        agreement = None
        if ai_evaluation is not None:
            agreement = ai_evaluation.correctness == sample["expectedLabel"]

        result = {
            "id": sample["id"],
            "questionId": sample["questionId"],
            "category": sample["category"],
            "studentAnswer": sample["studentAnswer"],
            "expectedLabel": sample["expectedLabel"],
            "latencySeconds": round(latency_seconds, 2),
            "error": error,
            "rawResponse": raw_text,
            "jsonParseSuccess": json_parse_success,
            "schemaValid": schema_valid,
            "aiCorrectness": ai_evaluation.correctness if ai_evaluation else None,
            "aiConfidence": ai_evaluation.confidence if ai_evaluation else None,
            "reasoningQuality": ai_evaluation.reasoning_quality if ai_evaluation else None,
            "misconceptionTags": ai_evaluation.misconception_tags if ai_evaluation else None,
            "explanation": ai_evaluation.explanation if ai_evaluation else None,
            "agreement": agreement,
        }
        results.append(result)

        status = "OK" if schema_valid else ("PARSE_FAIL" if not json_parse_success else "SCHEMA_FAIL")
        print(f"[{sample['id']}] {status} latency={latency_seconds:.2f}s agree={agreement}")

    summarize(results)
    save_results(results)


def summarize(results: list[dict]) -> None:
    total = len(results)
    parse_ok = [r for r in results if r["jsonParseSuccess"]]
    schema_ok = [r for r in results if r["schemaValid"]]
    agreements = [r for r in schema_ok if r["agreement"] is not None]
    correct_agreements = [r for r in agreements if r["agreement"]]
    latencies = [r["latencySeconds"] for r in results if r["error"] is None]
    confidences = [r["aiConfidence"] for r in schema_ok if r["aiConfidence"] is not None]

    print("\n=== Summary ===")
    print(f"Total samples: {total}")
    print(f"JSON parse success: {len(parse_ok)}/{total} ({100 * len(parse_ok) / total:.0f}%)")
    print(f"Schema valid: {len(schema_ok)}/{total} ({100 * len(schema_ok) / total:.0f}%)")
    if agreements:
        print(
            f"Correctness agreement (of schema-valid): {len(correct_agreements)}/{len(agreements)} "
            f"({100 * len(correct_agreements) / len(agreements):.0f}%)"
        )
    if latencies:
        print(
            f"Latency: mean={statistics.mean(latencies):.2f}s "
            f"median={statistics.median(latencies):.2f}s "
            f"min={min(latencies):.2f}s max={max(latencies):.2f}s"
        )
    if confidences:
        print(
            f"Confidence: mean={statistics.mean(confidences):.2f} "
            f"min={min(confidences):.2f} max={max(confidences):.2f}"
        )

    print("\n--- By category ---")
    categories = sorted({r["category"] for r in results})
    for category in categories:
        category_total = sum(1 for r in results if r["category"] == category)
        subset_valid = [r for r in schema_ok if r["category"] == category]
        subset_agree = [r for r in subset_valid if r["agreement"]]
        print(f"{category}: {len(subset_agree)}/{len(subset_valid)} agreed (of {category_total} total samples)")


def save_results(results: list[dict]) -> None:
    RESULTS_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = RESULTS_DIR / f"run_{timestamp}.json"
    output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nSaved raw results to {output_path}")


if __name__ == "__main__":
    run()
