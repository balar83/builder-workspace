from app.schemas.session import StudentLearningContext
from app.services import attempt_service, topic_service

# A topic is "weak" for revision-boost purposes when it has been attempted,
# isn't yet mastered, and accuracy is below this bar. A deliberately simple,
# named heuristic - not tuned or pedagogically validated - documented here
# rather than left as a magic number, per Milestone C1's implementation notes.
WEAK_ACCURACY_THRESHOLD = 0.6

RECENT_QUESTION_LIMIT = 10


def build_learning_context(student_id: str, chapter_id: str) -> StudentLearningContext:
    """
    Read-only, built fresh on every call from attempt_service (ADR-005) -
    never persisted, never cached. Safe for a first-time student: every
    field is present with an empty/False value rather than absent.
    """
    performance = attempt_service.get_performance(student_id)
    chapter_topic_ids = {topic.id for topic in topic_service.get_topics(chapter_id)}
    chapter_performance = [row for row in performance if row["topicId"] in chapter_topic_ids]

    topic_mastery = {row["topicId"]: row["mastered"] for row in chapter_performance}
    topic_accuracy = {row["topicId"]: row["accuracy"] for row in chapter_performance}
    weak_topic_ids = [
        row["topicId"]
        for row in chapter_performance
        if not row["mastered"] and row["accuracy"] < WEAK_ACCURACY_THRESHOLD
    ]
    recent_question_ids = attempt_service.get_recent_question_ids(
        student_id, chapter_id, limit=RECENT_QUESTION_LIMIT
    )

    return StudentLearningContext(
        studentId=student_id,
        chapterId=chapter_id,
        topicMastery=topic_mastery,
        topicAccuracy=topic_accuracy,
        weakTopicIds=weak_topic_ids,
        recentQuestionIds=recent_question_ids,
        hasHistory=len(chapter_performance) > 0,
    )
