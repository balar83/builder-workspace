from fastapi import APIRouter, HTTPException, Request

from app.schemas.session import (
    AssessmentRequest,
    CreateSessionRequest,
    CreateSessionResponse,
    CurrentQuestionResponse,
    QuestionContent,
    SessionSummaryResponse,
    SessionTerminalResponse,
    SubmitSessionAnswerRequest,
    SubmitSessionAnswerResponse,
)
from app.services import runtime_session_manager, session_builder

router = APIRouter()


def _require_student(request: Request) -> str:
    if request.session.get("role") != "student":
        raise HTTPException(status_code=401, detail="Student login required")
    return request.session["id"]


@router.post("/sessions", response_model=CreateSessionResponse)
def create_session(body: CreateSessionRequest, request: Request) -> CreateSessionResponse:
    student_id = _require_student(request)

    assessment_request = AssessmentRequest(
        studentId=student_id,
        chapterId=body.chapterId,
        mode=body.mode,
        difficulty=body.difficulty,
        questionTypes=body.questionTypes,
        questionCount=body.questionCount,
        timeLimitMinutes=body.timeLimitMinutes,
    )

    try:
        session = session_builder.create_session(assessment_request)
    except session_builder.SessionCreationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    actual_count = len(session.selectedQuestions)
    return CreateSessionResponse(
        sessionId=session.sessionId,
        targetCount=session.plan.targetCount,
        actualCount=actual_count,
        shortfall=actual_count < session.plan.targetCount,
    )


@router.get("/sessions/{session_id}/current-question")
def get_current_question(session_id: str, request: Request):
    student_id = _require_student(request)

    try:
        result = runtime_session_manager.get_current_question(session_id, student_id)
    except runtime_session_manager.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    total_count = len(result.session.selectedQuestions)

    if result.question is None:
        raise HTTPException(
            status_code=409,
            detail=SessionTerminalResponse(
                sessionId=result.session.sessionId,
                status=result.session.state.status,
                position=result.session.state.currentPosition,
                totalCount=total_count,
                correctCount=result.session.state.correctCount,
            ).model_dump(),
        )

    return CurrentQuestionResponse(
        position=result.session.state.currentPosition,
        totalCount=total_count,
        question=QuestionContent(
            id=result.question.id,
            question=result.question.question,
            text=result.question.text,
            difficulty=result.question.difficulty,
            hints=result.question.hints,
            solution=result.question.solution,
            questionType=result.question.questionType,
            responseSpecification=result.question.responseSpecification,
        ),
    )


@router.post("/sessions/{session_id}/answer", response_model=SubmitSessionAnswerResponse)
def submit_session_answer(
    session_id: str, body: SubmitSessionAnswerRequest, request: Request
) -> SubmitSessionAnswerResponse:
    student_id = _require_student(request)

    try:
        result = runtime_session_manager.submit_answer(session_id, student_id, body.position, body.answer)
    except runtime_session_manager.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except runtime_session_manager.SessionNotSubmittableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return SubmitSessionAnswerResponse(
        evaluation=result.evaluation.evaluation,
        coach=result.evaluation.coach,
        ui=result.evaluation.ui,
        remediation=result.evaluation.remediation,
        position=result.session.state.currentPosition,
        totalCount=len(result.session.selectedQuestions),
        sessionStatus=result.session.state.status,
    )


@router.get("/sessions/{session_id}", response_model=SessionSummaryResponse)
def get_session_summary(session_id: str, request: Request) -> SessionSummaryResponse:
    student_id = _require_student(request)

    try:
        session = runtime_session_manager.get_session_summary(session_id, student_id)
    except runtime_session_manager.SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SessionSummaryResponse(
        sessionId=session.sessionId,
        mode=session.plan.mode,
        status=session.state.status,
        position=session.state.currentPosition,
        totalCount=len(session.selectedQuestions),
        correctCount=session.state.correctCount,
        startedAt=session.state.startedAt,
        completedAt=session.state.completedAt,
        timeLimitMinutes=session.plan.timeLimitMinutes,
    )
