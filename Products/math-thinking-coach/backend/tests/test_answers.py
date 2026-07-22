from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

QUESTION_ID = "q1-rational-numbers"
QUESTION_URL = f"/api/v1/questions/{QUESTION_ID}/answer"


def submit(answer: str, attempt_number: int):
    return client.post(
        QUESTION_URL,
        json={"submission": {"answer": answer, "attemptNumber": attempt_number}},
    )


def test_correct_answer_returns_next_question() -> None:
    response = submit("1/2", 1)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {"isCorrect": True, "score": 1.0},
        "coach": {
            "message": "Excellent! You solved it correctly.",
            "nextAction": "NEXT_QUESTION",
        },
        "ui": {"canTryAgain": False, "canRevealSolution": False, "hintLevel": 0},
    }


def test_correct_answer_ignores_leading_and_trailing_spaces() -> None:
    response = submit("  1/2  ", 1)

    assert response.status_code == 200
    assert response.json()["evaluation"]["isCorrect"] is True


def test_incorrect_first_attempt_returns_try_again() -> None:
    response = submit("wrong", 1)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {"isCorrect": False, "score": 0.0},
        "coach": {
            "message": "Not quite. Try solving it once more before using a hint.",
            "nextAction": "TRY_AGAIN",
        },
        "ui": {"canTryAgain": True, "canRevealSolution": False, "hintLevel": 0},
    }


def test_incorrect_second_attempt_returns_show_hint() -> None:
    response = submit("wrong", 2)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {"isCorrect": False, "score": 0.0},
        "coach": {
            "message": "Good effort. Here's a hint to help you.",
            "nextAction": "SHOW_HINT",
        },
        "ui": {"canTryAgain": True, "canRevealSolution": False, "hintLevel": 1},
    }


def test_incorrect_third_attempt_returns_show_solution() -> None:
    response = submit("wrong", 3)

    assert response.status_code == 200
    assert response.json() == {
        "evaluation": {"isCorrect": False, "score": 0.0},
        "coach": {
            "message": "If you're still stuck, you can view the solution.",
            "nextAction": "SHOW_SOLUTION",
        },
        "ui": {"canTryAgain": False, "canRevealSolution": True, "hintLevel": 2},
    }


def test_incorrect_fourth_attempt_still_returns_show_solution() -> None:
    response = submit("wrong", 4)

    assert response.status_code == 200
    assert response.json()["coach"]["nextAction"] == "SHOW_SOLUTION"


def test_submit_answer_returns_404_for_unknown_question() -> None:
    response = client.post(
        "/api/v1/questions/unknown-question/answer",
        json={"submission": {"answer": "1/2", "attemptNumber": 1}},
    )

    assert response.status_code == 404


def test_empty_answer_is_treated_as_incorrect() -> None:
    response = submit("", 1)

    assert response.status_code == 200
    assert response.json()["evaluation"] == {"isCorrect": False, "score": 0.0}
    assert response.json()["coach"]["nextAction"] == "TRY_AGAIN"


def test_missing_submission_field_returns_422() -> None:
    response = client.post(QUESTION_URL, json={})

    assert response.status_code == 422


def test_non_integer_attempt_number_returns_422() -> None:
    response = client.post(
        QUESTION_URL,
        json={"submission": {"answer": "1/2", "attemptNumber": "not-a-number"}},
    )

    assert response.status_code == 422


def test_missing_answer_field_returns_422() -> None:
    response = client.post(QUESTION_URL, json={"submission": {"attemptNumber": 1}})

    assert response.status_code == 422
