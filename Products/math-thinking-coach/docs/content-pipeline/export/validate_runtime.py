"""Validates transformed runtime objects against the REAL backend Pydantic
schemas (app.schemas.*) - not a hand-maintained copy. Run from backend/ so the
app package resolves. Reads a JSON payload on stdin, writes a JSON result to
stdout. Never modifies anything - read-only validation.
"""

import json
import os
import sys

# This script lives outside the backend/ package, so Python's default
# sys.path[0] (the script's own directory) will not resolve `app.*`. The
# caller always sets cwd to backend/ when spawning this process; insert that
# onto sys.path explicitly so the import below resolves the real package.
sys.path.insert(0, os.getcwd())

from pydantic import ValidationError

from app.schemas.chapter import Chapter
from app.schemas.question import Question
from app.schemas.topic import Topic


def validate_list(model, items, label):
    errors = []
    for index, item in enumerate(items):
        try:
            model.model_validate(item)
        except ValidationError as exc:
            errors.append(
                {
                    "label": label,
                    "index": index,
                    "id": item.get("id") if isinstance(item, dict) else None,
                    "errors": exc.errors(),
                }
            )
    return errors


def main():
    payload = json.load(sys.stdin)

    all_errors = []
    all_errors += validate_list(Chapter, payload.get("chapters", []), "chapter")
    all_errors += validate_list(Topic, payload.get("topics", []), "topic")
    all_errors += validate_list(Question, payload.get("questions", []), "question")

    result = {"valid": len(all_errors) == 0, "errors": all_errors}
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
