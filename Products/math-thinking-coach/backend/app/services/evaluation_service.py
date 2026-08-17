import json
from fractions import Fraction
from pathlib import Path

from app.schemas.answer import AnswerSubmission, EvaluationResult
from app.schemas.question import Question

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_answer_keys: dict[str, str] = json.loads(
    (DATA_DIR / "answer_keys.json").read_text(encoding="utf-8")
)


def get_expected_answer(question_id: str) -> str:
    """
    Returns the canonical expected answer for a question, used by both
    rule-based evaluation and Shadow Mode AI evaluation.

    Raises KeyError if the question does not exist.
    """
    return _answer_keys[question_id]


def _evaluate_short_text(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    Behavior-preserving extraction of the evaluator this project has always
    had: exact match after stripping whitespace. This is the default
    evaluator (Question.questionType == "short_text" unless set otherwise),
    so this function's behavior for all 241 existing questions is unchanged.
    """
    expected_answer = get_expected_answer(question.id)
    is_correct = submission.answer.strip() == expected_answer.strip()
    return EvaluationResult(
        isCorrect=is_correct,
        score=question.maxScore if is_correct else 0.0,
        maxScore=question.maxScore,
        evaluatorId="short_text_v1",
    )


def _parse_number(raw: str) -> Fraction | None:
    """
    Exact rational parsing (not float) - "1/2" and "0.5" parse to the same
    Fraction, so they compare equal even with zero tolerance. Returns None,
    never raises, for anything that isn't a clean number (e.g. "18 m") - the
    caller decides what that means rather than this crashing the request.
    """
    try:
        return Fraction(raw.strip())
    except (ValueError, ZeroDivisionError):
        return None


def _evaluate_numeric(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    Deterministic Fraction-based numeric comparison - not a symbolic math
    engine. "1/2" == "0.5" and "4" == "4.0" compare correct with zero
    tolerance (the default); Question.responseSpecification.numericTolerance
    widens that to an approximate-answer band only when a question opts in.
    """
    expected_answer = get_expected_answer(question.id)
    tolerance = question.responseSpecification.numericTolerance if question.responseSpecification else 0.0

    expected_value = _parse_number(expected_answer)
    submitted_value = _parse_number(submission.answer)

    if expected_value is None:
        # Content-authoring mistake (this question is typed "numeric" but
        # its canonical answer isn't a clean number, e.g. carries a unit) -
        # fail safe to exact-text comparison rather than raising into the
        # student's request.
        is_correct = submission.answer.strip() == expected_answer.strip()
    elif submitted_value is None:
        # A non-numeric submission to a numeric question is simply wrong,
        # not an error.
        is_correct = False
    elif tolerance > 0:
        is_correct = abs(float(submitted_value) - float(expected_value)) <= tolerance
    else:
        is_correct = submitted_value == expected_value

    return EvaluationResult(
        isCorrect=is_correct,
        score=question.maxScore if is_correct else 0.0,
        maxScore=question.maxScore,
        evaluatorId="numeric_tolerance_v1",
    )


def _evaluate_single_choice(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    The expected answer is the correct option's id, resolved through the
    exact same private answer_keys.json path every other evaluator uses -
    no second answer-key mechanism. AnswerSubmission.answer carries the
    selected option's id as a plain string; no new submission shape was
    needed, since "which one option was picked" fits a single string
    exactly as naturally as short_text/numeric's answers do.
    """
    expected_option_id = get_expected_answer(question.id)
    valid_option_ids = (
        {option.id for option in question.responseSpecification.options}
        if question.responseSpecification and question.responseSpecification.options
        else set()
    )
    submitted_option_id = submission.answer.strip()

    if submitted_option_id not in valid_option_ids:
        # Distinguished from a recognized-but-wrong option via `evidence`,
        # not a separate boolean - both cases are simply incorrect, but a
        # future consumer (or a debugging session) can tell them apart.
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="single_choice_v1",
            evidence="submitted option id is not among this question's valid options",
        )

    is_correct = submitted_option_id == expected_option_id
    return EvaluationResult(
        isCorrect=is_correct,
        score=question.maxScore if is_correct else 0.0,
        maxScore=question.maxScore,
        evaluatorId="single_choice_v1",
    )


def _parse_option_id_set(raw: str) -> set[str] | None:
    """
    Splits the canonical comma-delimited option-id string (Slice 3) into a
    set - shared by both the student submission and the private
    answer_keys.json value, so both sides parse identically. Whitespace
    around each token is trimmed. An empty (or whitespace-only) string is
    well-formed and parses to an empty set - "nothing selected" is valid
    input, just always wrong (design doc Part II §B correction). Any empty
    token from a malformed value ("a,,b" or a trailing "a,b,") returns None,
    never raises, so the caller can fail safe to "incorrect" rather than
    crashing the request - same posture as _parse_number above.
    """
    stripped = raw.strip()
    if stripped == "":
        return set()
    tokens = [token.strip() for token in stripped.split(",")]
    if any(token == "" for token in tokens):
        return None
    return set(tokens)


def _evaluate_multi_choice(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    Multi Choice / select-all (Slice 3): exact-set equality, all-or-nothing.
    No partial credit, no per-option weighting, no rubric. Both the
    submission and the private answer_keys.json value are the SAME
    comma-delimited option-id string convention - no new
    AnswerSubmission/session field was needed, since a *set* of ids fits
    that one-string shape exactly as naturally as single_choice's single id
    did. Order and duplicates never matter - both sides are compared as
    sets, per design doc Part II §B/§D correction.
    """
    expected_option_ids = _parse_option_id_set(get_expected_answer(question.id)) or set()
    valid_option_ids = (
        {option.id for option in question.responseSpecification.options}
        if question.responseSpecification and question.responseSpecification.options
        else set()
    )
    submitted_option_ids = _parse_option_id_set(submission.answer)

    if submitted_option_ids is None:
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="multi_choice_v1",
            evidence="submitted answer is not a well-formed comma-delimited list of option ids",
        )

    if not submitted_option_ids.issubset(valid_option_ids):
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="multi_choice_v1",
            evidence="submitted option ids are not all among this question's valid options",
        )

    is_correct = submitted_option_ids == expected_option_ids
    return EvaluationResult(
        isCorrect=is_correct,
        score=question.maxScore if is_correct else 0.0,
        maxScore=question.maxScore,
        evaluatorId="multi_choice_v1",
    )


# The one dispatch point in the system (design doc §6): every consumer
# (answer_service, runtime_session_manager, Shadow Mode) only ever sees the
# EvaluationResult an evaluator produces, never questionType itself - no
# if/elif ladder exists or should be added anywhere else. Plain functions in
# a dict, not classes, matching this project's service-module convention
# (Phase-1-Handoff.md §16).
_EVALUATORS = {
    "short_text": _evaluate_short_text,
    "numeric": _evaluate_numeric,
    "single_choice": _evaluate_single_choice,
    "multi_choice": _evaluate_multi_choice,
}


def evaluate(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    evaluator = _EVALUATORS.get(question.questionType)
    if evaluator is None:
        # Reserved-but-unimplemented questionType (multi_choice, fill_blank,
        # matching, multi_part) - the content pipeline (loadCanonical.js)
        # already refuses to export a question naming one of these, so this
        # should never occur in production; raised loudly here rather than
        # silently guessing.
        raise ValueError(
            f'No evaluator is registered for questionType="{question.questionType}" '
            f"(question {question.id}) - this type is reserved for a future slice."
        )
    return evaluator(question, submission)
