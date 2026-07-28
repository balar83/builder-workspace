from app.schemas.question import Question
from app.schemas.session import QuestionCandidate
from app.services import question_service

# Retrieval -> normalization convention (design review, round 2): a source
# adapter's only job is to fetch its raw records; _normalize_* converts them
# to the one shared QuestionCandidate shape Question Selector consumes. Only
# one source exists today (canonical/template-exported content, both already
# shaped as Question by the Stage 10 export pipeline, ADR-003) - retrieval and
# normalization happen to collapse into one step for it. A second source
# (AI-generated, teacher-upload, PDF-extracted) should add its own
# _normalize_<source> function here, not fabricate a QuestionCandidate ad hoc.


def get_candidates(chapter_id: str, topic_ids: list[str] | None = None) -> list[QuestionCandidate]:
    questions = question_service.get_questions(chapter_id)
    if topic_ids is not None:
        questions = [question for question in questions if question.topicId in topic_ids]
    return [_normalize_canonical(question) for question in questions]


def _normalize_canonical(question: Question) -> QuestionCandidate:
    return QuestionCandidate(
        id=question.id,
        chapterId=question.chapterId,
        topicId=question.topicId,
        difficulty=question.difficulty,
        # No question-type field exists on the runtime Question schema yet
        # (P2, not built) - always None until it does.
        type=None,
        sourceType="canonical",
        # Stage 10 export (ADR-003) already gates on reviewStatus before
        # anything reaches runtime data; there is no second check to make.
        reviewStatus="approved",
    )


def get_question_content(question_id: str) -> Question | None:
    """
    The second, narrow entry point (Milestone C2): full display content for
    exactly one already-selected question, distinct from get_candidates'
    lean, pool-wide, selection-time records. Reuses the existing Question
    model unchanged - no new schema. This is the only path Runtime Session
    Manager may use to read question content; it never imports
    question_service directly.

    Any field considered for QuestionCandidate in the future should answer
    "does Question Selector need this to choose among candidates?" - if the
    honest answer is "no, only to display the one that's chosen," it
    belongs here, not there.
    """
    return question_service.get_question_by_id(question_id)
