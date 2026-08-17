from typing import Literal

from pydantic import BaseModel

Difficulty = Literal["Easy", "Medium", "Hard"]

# Slice 1 (Question & Response Semantics, M2): the full durable taxonomy is
# named now so canonical content and tooling never have to guess at future
# values - only "short_text" and "numeric" have a registered evaluator
# (evaluation_service.py) in this slice. The other five are reserved,
# structurally valid values, but rejected at export time (loadCanonical.js)
# until their own slice implements them - see
# docs/Question-Response-Semantics-Design-Proposal.md §9/§17.
QuestionType = Literal[
    "short_text",
    "numeric",
    "single_choice",
    "multi_choice",
    "fill_blank",
    "matching",
    "multi_part",
]


class ResponseSpecification(BaseModel):
    """
    Deliberately minimal for Slice 1 - only the one parameter an implemented
    evaluator actually reads (numericTolerance, consulted by the numeric
    evaluator only). Does NOT carry the expected answer itself: Question
    (and therefore ResponseSpecification) is returned by public GET routes,
    and the expected answer stays private in answer_keys.json (ADR-001) for
    every questionType, including numeric - putting it here would leak it to
    the client. This is a deliberate, narrower shape than the design
    proposal's illustrative one; see the Slice 1 implementation report for
    why acceptedAnswers/caseSensitive were dropped.
    """

    numericTolerance: float = 0.0


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
    # Additive, Slice 1 (M2, Question & Response Semantics): defaults
    # preserve today's behavior exactly for all 241 existing questions, with
    # no canonical content edits required. See
    # docs/Question-Response-Semantics-Design-Proposal.md §4/§13.
    questionType: QuestionType = "short_text"
    responseSpecification: ResponseSpecification | None = None
    maxScore: float = 1.0
