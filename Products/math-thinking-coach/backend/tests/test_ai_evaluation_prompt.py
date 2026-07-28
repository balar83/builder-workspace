from app.services.ai_evaluation_prompt import build_prompt


def test_question_text_is_interpolated() -> None:
    prompt = build_prompt(
        question="What is the result of adding 1/3 and 1/6?",
        expected_answer="1/2",
        student_answer="1/2",
    )

    assert "What is the result of adding 1/3 and 1/6?" in prompt


def test_expected_answer_is_interpolated() -> None:
    prompt = build_prompt(
        question="What is the result of adding 1/3 and 1/6?",
        expected_answer="1/2",
        student_answer="wrong",
    )

    assert "Expected answer: 1/2" in prompt


def test_student_answer_is_interpolated() -> None:
    prompt = build_prompt(
        question="What is the result of adding 1/3 and 1/6?",
        expected_answer="1/2",
        student_answer="4/8",
    )

    assert "Student's answer: 4/8" in prompt


def test_json_output_instruction_block_is_present() -> None:
    prompt = build_prompt(
        question="What is the result of adding 1/3 and 1/6?",
        expected_answer="1/2",
        student_answer="1/2",
    )

    assert '"correctness": true or false' in prompt
    assert '"confidence": a number between 0.0 and 1.0' in prompt
    assert '"reasoning_quality": one of "NONE", "WEAK", "PARTIAL", "SOUND"' in prompt
    assert '"misconception_tags": a list of short strings' in prompt
    assert '"explanation": a one-sentence explanation' in prompt
    assert "Only output the JSON object." in prompt
