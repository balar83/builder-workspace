import json
from pathlib import Path

from app.schemas.chapter import Chapter
from app.schemas.question import Question

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_chapters = [
    Chapter(**item) for item in json.loads((DATA_DIR / "chapters.json").read_text(encoding="utf-8"))
]
_questions = [
    Question(**item) for item in json.loads((DATA_DIR / "questions.json").read_text(encoding="utf-8"))
]


def get_chapters() -> list[Chapter]:
    return _chapters


def get_chapter(chapter_id: str) -> Chapter | None:
    return next((chapter for chapter in _chapters if chapter.id == chapter_id), None)


def get_questions(chapter_id: str) -> list[Question]:
    return [question for question in _questions if question.chapterId == chapter_id]


def get_question(chapter_id: str, question_id: str) -> Question | None:
    return next(
        (
            question
            for question in _questions
            if question.chapterId == chapter_id and question.id == question_id
        ),
        None,
    )
