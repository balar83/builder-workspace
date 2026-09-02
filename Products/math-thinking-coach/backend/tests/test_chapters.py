from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_chapters_returns_all_chapters() -> None:
    response = client.get("/api/v1/chapters")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 7
    assert body[0]["id"] == "rational-numbers"


def test_get_chapter_returns_single_chapter() -> None:
    response = client.get("/api/v1/chapters/linear-equations")

    assert response.status_code == 200
    assert response.json() == {
        "id": "linear-equations",
        "title": "Linear Equations",
        "description": "Solving linear equations in one variable and applications.",
    }


def test_get_chapter_returns_404_for_unknown_chapter() -> None:
    response = client.get("/api/v1/chapters/unknown-chapter")

    assert response.status_code == 404
