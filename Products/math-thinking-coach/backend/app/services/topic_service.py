import json
from pathlib import Path

from app.schemas.topic import Topic

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_topics = [
    Topic(**item) for item in json.loads((DATA_DIR / "topics.json").read_text(encoding="utf-8"))
]


def get_topics(chapter_id: str) -> list[Topic]:
    return [topic for topic in _topics if topic.chapterId == chapter_id]


def get_topic(topic_id: str) -> Topic | None:
    return next((topic for topic in _topics if topic.id == topic_id), None)
