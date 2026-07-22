"""Experimental structured evaluation output.

Mirrors the internal evaluation model shape sketched in the Feature 013
design proposal. This lives only inside the playground and is separate
from app.schemas.answer.Evaluation — no production schema is touched or
implied to change by this file.
"""

from pydantic import BaseModel


class AIEvaluation(BaseModel):
    correctness: bool
    confidence: float
    reasoning_quality: str
    misconception_tags: list[str] = []
    explanation: str
