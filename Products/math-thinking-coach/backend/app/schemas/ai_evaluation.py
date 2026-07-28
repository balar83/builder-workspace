from pydantic import BaseModel


class AIEvaluation(BaseModel):
    correctness: bool
    confidence: float
    reasoning_quality: str
    misconception_tags: list[str] = []
    explanation: str


class AIEvaluationOutcome(BaseModel):
    succeeded: bool
    evaluation: AIEvaluation | None
    error: str | None
    latencySeconds: float
