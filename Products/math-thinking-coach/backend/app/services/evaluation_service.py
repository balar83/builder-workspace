import json
import re
import unicodedata
from fractions import Fraction
from pathlib import Path

from app.schemas.answer import AnswerSubmission, EvaluationResult, PartEvaluationResult
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



# M3: a conservative safelist - only ordinary sentence punctuation a student
# might incidentally type ("Yes." / "Y," / 'the answer is "no"'). Deliberately
# excludes any character that carries mathematical meaning in an expression
# (-, +, =, /, *, ^, parentheses) so algebra-expression short_text answers
# (e.g. multi_part's "9 - 2x") are never affected - stripping "-" there would
# collide "9 - 2x" and "9 + 2x" onto the same normalized string, a real
# grading-correctness regression, not a convenience.
_STRIPPABLE_PUNCTUATION_RE = re.compile(r"""[.,!?;:'"]""")
_WHITESPACE_RE = re.compile(r"\s+")


def _normalize_short_text(value: str) -> str:
    """
    M3: Unicode NFKC normalization, casefold, strip the punctuation safelist
    above, then collapse/trim whitespace. Applied to the canonical answer,
    every authored alias, and the submission alike, so e.g. "YES" (canonical)
    and " yes " (submission) already matched before M3 and still do -
    casefold only ever makes two previously-different strings equal, never
    the reverse.
    """
    text = unicodedata.normalize("NFKC", value)
    text = text.casefold()
    text = _STRIPPABLE_PUNCTUATION_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


def _compare_short_text_values(expected: str, submitted: str, aliases: list[str] | None = None) -> bool:
    """
    M3: matches the submission against the normalized canonical answer OR
    any normalized authored alias. `aliases` defaults to None/empty for
    every question with none authored - the canonical answer alone remains
    authoritative, and no synonym is ever accepted beyond what was
    explicitly authored for that question. Reused by _evaluate_multi_part
    for a short_text-typed part, passing that part's own aliases (if any)
    rather than the whole question's.
    """
    normalized_submitted = _normalize_short_text(submitted)
    candidates = [expected, *(aliases or [])]
    return any(normalized_submitted == _normalize_short_text(candidate) for candidate in candidates)


def _evaluate_short_text(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    The default evaluator (Question.questionType == "short_text" unless set
    otherwise). M3: normalized match (see _normalize_short_text) against the
    canonical answer or any of the question's authored
    responseSpecification.aliases - both default to today's plain
    strip-and-compare behavior for the ~349 existing questions with neither
    unusual casing/punctuation in their answers nor any aliases authored.
    """
    expected_answer = get_expected_answer(question.id)
    aliases = question.responseSpecification.aliases if question.responseSpecification else None
    is_correct = _compare_short_text_values(expected_answer, submission.answer, aliases)
    return EvaluationResult(
        isCorrect=is_correct,
        score=question.maxScore if is_correct else 0.0,
        maxScore=question.maxScore,
        evaluatorId="short_text_v1",
    )



# M2: an optional leading sign, an integer whole part, whitespace, then a
# simple a/b fraction - e.g. "1 1/2" or "-1 1/2". Fraction() has no native
# mixed-number syntax, so this is parsed by hand and reassembled as
# whole + numerator/denominator before falling back to Fraction() for
# every other shape (plain integers, decimals, simple "a/b" fractions).
_MIXED_NUMBER_RE = re.compile(r"^(-)?(\d+)\s+(\d+)/(\d+)$")


def _parse_number(raw: str) -> Fraction | None:
    """
    Exact rational parsing (not float) - "1/2" and "0.5" parse to the same
    Fraction, so they compare equal even with zero tolerance. Returns None,
    never raises, for anything that isn't a clean number (e.g. "18 m") - the
    caller decides what that means rather than this crashing the request.

    M2 additions, both still exact (no float involved at any step):
    - a trailing "%" divides the parsed value by 100 (Fraction(100), not
      0.01, so "50%" stays exactly Fraction(1, 2), not a near-miss float).
    - a mixed number ("1 1/2", "-1 1/2") is parsed via _MIXED_NUMBER_RE and
      reassembled as whole + numerator/denominator (sign applied to the
      combined value, matching ordinary mixed-number notation - "-1 1/2"
      means -(1 + 1/2), not (-1) + 1/2).
    """
    text = raw.strip()
    is_percent = text.endswith("%")
    if is_percent:
        text = text[:-1].strip()

    mixed_match = _MIXED_NUMBER_RE.fullmatch(text)
    if mixed_match:
        sign, whole, numerator, denominator = mixed_match.groups()
        try:
            value = Fraction(int(whole)) + Fraction(int(numerator), int(denominator))
        except ZeroDivisionError:
            return None
        if sign == "-":
            value = -value
    else:
        try:
            value = Fraction(text)
        except (ValueError, ZeroDivisionError):
            return None

    return value / 100 if is_percent else value


def _compare_numeric_values(expected: str, submitted: str, tolerance: float) -> bool:
    """
    The Fraction-based numeric comparison itself, factored out (M3) so
    _evaluate_multi_part can reuse the identical semantics for a
    numeric-typed part - same fail-safe branches as _evaluate_numeric below,
    just parameterized on the two raw strings and a tolerance instead of a
    whole Question/AnswerSubmission pair. No behavior change for
    _evaluate_numeric below.
    """
    expected_value = _parse_number(expected)
    submitted_value = _parse_number(submitted)

    if expected_value is None:
        # Content-authoring mistake (this question is typed "numeric" but
        # its canonical answer isn't a clean number, e.g. carries a unit) -
        # fail safe to exact-text comparison rather than raising into the
        # student's request.
        return submitted.strip() == expected.strip()
    if submitted_value is None:
        # A non-numeric submission to a numeric question is simply wrong,
        # not an error.
        return False
    if tolerance > 0:
        return abs(float(submitted_value) - float(expected_value)) <= tolerance
    return submitted_value == expected_value


def _evaluate_numeric(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    Deterministic Fraction-based numeric comparison - not a symbolic math
    engine. "1/2" == "0.5" and "4" == "4.0" compare correct with zero
    tolerance (the default); Question.responseSpecification.numericTolerance
    widens that to an approximate-answer band only when a question opts in.
    """
    expected_answer = get_expected_answer(question.id)
    tolerance = question.responseSpecification.numericTolerance if question.responseSpecification else 0.0
    is_correct = _compare_numeric_values(expected_answer, submission.answer, tolerance)

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


_PART_ANSWER_DELIMITER = "|"


def _split_part_tokens(raw: str, expected_count: int) -> list[str] | None:
    """
    Splits a flat, "|"-delimited multi-part string into exactly
    expected_count trimmed tokens. Returns None (never raises) for anything
    that doesn't split into exactly that many pieces - same fail-safe
    posture as _parse_number/_parse_option_id_set above, so a malformed
    submission or a content-authoring answer-key/part-count mismatch is
    simply "incorrect", never a crash into the request.
    """
    tokens = raw.split(_PART_ANSWER_DELIMITER)
    if len(tokens) != expected_count:
        return None
    return [token.strip() for token in tokens]


def _evaluate_multi_part(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    """
    M3. Decomposes a multi_part Question into its ordered
    responseSpecification.parts and evaluates each part independently, per
    docs/Question-Response-Semantics-Design-Proposal.md Part II §C/§G and
    the M3 implementation authorization's three decisions:

    - Decision 1 (submission encoding): AnswerSubmission stays the existing
      flat `answer: str` - no recursive partResponses field. Both the
      private answer_keys.json value and the student's submission encode
      their ordered part answers as one "|"-delimited string, the same
      "one opaque delimited string, parsed only by this evaluator"
      convention _evaluate_multi_choice already established for its own
      comma-delimited option-id set. "|" was chosen, not reused from
      multi_choice's ",", because it appears in none of le-q25/le-q37/
      le-q40's real part answers ("9 - 2x", "5x + 2", "16", "21", "12",
      "8") - verified directly against content before this evaluator was
      written, not assumed safe by analogy.
    - Decision 2 (part ordering): parts are positional and order-fixed - no
      permutation/unordered-set matching is attempted anywhere below.
    - Decision 3 (algebraic parts): a short_text-typed part (le-q25's LHS/
      RHS) gets exactly today's short_text comparison - strip-then-compare,
      no algebra parser, no equivalence beyond that.

    isCorrect is True only when every part is correct - this is what lets
    coaching_service.decide(is_correct, attempt_number) keep working
    completely unchanged even for a partially-correct multi-part
    submission; the richer partial-credit information rides alongside in
    score/maxScore/partResults (never scoreBreakdown, which stays reserved
    for a future single-response rubric evaluator - design doc §C) for
    whichever future consumer wants it.
    """
    parts = question.responseSpecification.parts if question.responseSpecification else None
    if not parts:
        # Defensive: Stage 10 already refuses to export a multi_part
        # question with no parts, but the evaluator must not crash if one
        # somehow reaches it (e.g. a directly-constructed Question), same
        # posture as single_choice/multi_choice's own "no options" tests.
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="multi_part_v1",
            evidence="question has no configured parts",
        )

    expected_answer = get_expected_answer(question.id)
    expected_tokens = _split_part_tokens(expected_answer, len(parts))
    if expected_tokens is None:
        # Content-authoring error: the private answer key doesn't split
        # into exactly as many "|"-delimited tokens as this question has
        # parts. Fails safe, same posture as every other evaluator's
        # content-authoring-mistake branch in this module.
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="multi_part_v1",
            evidence="answer key does not match this question's part count",
        )

    submitted_tokens = _split_part_tokens(submission.answer, len(parts))
    if submitted_tokens is None:
        return EvaluationResult(
            isCorrect=False,
            score=0.0,
            maxScore=question.maxScore,
            evaluatorId="multi_part_v1",
            evidence=f'submission must contain exactly {len(parts)} part(s) separated by "{_PART_ANSWER_DELIMITER}"',
        )

    part_results: list[PartEvaluationResult] = []
    for part, expected_token, submitted_token in zip(parts, expected_tokens, submitted_tokens):
        if part.questionType == "short_text":
            part_aliases = part.responseSpecification.aliases if part.responseSpecification else None
            is_part_correct = _compare_short_text_values(expected_token, submitted_token, part_aliases)
            part_evaluator_id = "short_text_v1"
        elif part.questionType == "numeric":
            tolerance = part.responseSpecification.numericTolerance if part.responseSpecification else 0.0
            is_part_correct = _compare_numeric_values(expected_token, submitted_token, tolerance)
            part_evaluator_id = "numeric_tolerance_v1"
        else:
            # Not attempted by M3 (Decision 3's explicit scope) - a part
            # naming any other questionType fails safe to incorrect for
            # that part rather than crashing on a comparison this evaluator
            # doesn't yet implement.
            is_part_correct = False
            part_evaluator_id = "multi_part_v1"

        part_results.append(
            PartEvaluationResult(
                partId=part.id,
                isCorrect=is_part_correct,
                score=part.maxScore if is_part_correct else 0.0,
                maxScore=part.maxScore,
                evaluatorId=part_evaluator_id,
            )
        )

    total_score = sum(result.score for result in part_results)
    total_max_score = sum(result.maxScore for result in part_results)
    is_correct = all(result.isCorrect for result in part_results)

    return EvaluationResult(
        isCorrect=is_correct,
        score=total_score,
        maxScore=total_max_score,
        evaluatorId="multi_part_v1",
        partResults=part_results,
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
    "multi_part": _evaluate_multi_part,
}


def evaluate(question: Question, submission: AnswerSubmission) -> EvaluationResult:
    evaluator = _EVALUATORS.get(question.questionType)
    if evaluator is None:
        # Reserved-but-unimplemented questionType (fill_blank, matching) -
        # the content pipeline (loadCanonical.js) already refuses to export
        # a question naming one of these, so this should never occur in
        # production; raised loudly here rather than silently guessing.
        raise ValueError(
            f'No evaluator is registered for questionType="{question.questionType}" '
            f"(question {question.id}) - this type is reserved for a future slice."
        )
    return evaluator(question, submission)
