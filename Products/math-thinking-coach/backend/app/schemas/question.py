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
    topicId: str | None = None
    # Additive, Slice A1: stable relationship to LearningObjective ids (§B of
    # Structured-Learning-Content-Design-Proposal.md). Unused by any service
    # in this slice - not evaluation, coaching, or session-planning semantics.
    objectiveIds: list[str] | None = None
