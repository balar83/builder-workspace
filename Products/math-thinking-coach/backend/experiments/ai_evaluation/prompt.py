"""First-cut evaluation prompt. No prompt optimization has been done yet."""

PROMPT_TEMPLATE = """You are evaluating a Class 8 student's answer to a math question.

Question: {question}
Expected answer: {expected_answer}
Student's answer: {student_answer}

Evaluate the student's answer and respond with ONLY a JSON object in this exact shape, no other text before or after it:

{{
  "correctness": true or false,
  "confidence": a number between 0.0 and 1.0 indicating how confident you are in this judgment,
  "reasoning_quality": one of "NONE", "WEAK", "PARTIAL", "SOUND" describing the quality of the student's shown reasoning, or "NONE" if no reasoning was shown,
  "misconception_tags": a list of short strings naming any specific mathematical misconception in the answer, or an empty list if none,
  "explanation": a one-sentence explanation of your judgment
}}

Only output the JSON object."""


def build_prompt(question: str, expected_answer: str, student_answer: str) -> str:
    return PROMPT_TEMPLATE.format(
        question=question,
        expected_answer=expected_answer,
        student_answer=student_answer,
    )
