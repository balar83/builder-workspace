from typing import Literal

from pydantic import BaseModel

Difficulty = Literal["Easy", "Medium", "Hard"]


class Question(BaseModel):
    id: str
    chapterId: str
    question: str
    text: str
    difficulty: Difficulty
    hints: list[str]
    solution: str
