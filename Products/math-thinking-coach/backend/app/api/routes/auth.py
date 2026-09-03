from fastapi import APIRouter, HTTPException, Request

from app.schemas.user import (
    ClassCreateRequest,
    ClassPublic,
    CurrentUser,
    StudentJoinRequest,
    StudentLoginRequest,
    StudentPublic,
    TeacherLoginRequest,
    TeacherPublic,
    TeacherRegisterRequest,
)
from app.services import auth_service

router = APIRouter()


def _require_teacher(request: Request) -> str:
    if request.session.get("role") != "teacher":
        raise HTTPException(status_code=401, detail="Teacher login required")
    return request.session["id"]


@router.post("/auth/teacher/register", response_model=TeacherPublic)
def register_teacher(body: TeacherRegisterRequest, request: Request) -> TeacherPublic:
    try:
        teacher = auth_service.register_teacher(body.email, body.password, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request.session.clear()
    request.session["role"] = "teacher"
    request.session["id"] = teacher.id
    return TeacherPublic(id=teacher.id, email=teacher.email, name=teacher.name)


@router.post("/auth/teacher/login", response_model=TeacherPublic)
def login_teacher(body: TeacherLoginRequest, request: Request) -> TeacherPublic:
    teacher = auth_service.authenticate_teacher(body.email, body.password)
    if teacher is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    request.session.clear()
    request.session["role"] = "teacher"
    request.session["id"] = teacher.id
    return TeacherPublic(id=teacher.id, email=teacher.email, name=teacher.name)


@router.post("/auth/teacher/classes", response_model=ClassPublic)
def create_class(body: ClassCreateRequest, request: Request) -> ClassPublic:
    teacher_id = _require_teacher(request)
    try:
        class_group = auth_service.create_class(teacher_id, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ClassPublic(id=class_group.id, name=class_group.name, code=class_group.code)


@router.post("/auth/student/join", response_model=StudentPublic)
def join_class(body: StudentJoinRequest, request: Request) -> StudentPublic:
    try:
        student = auth_service.join_class(body.classCode, body.displayName, body.pin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    request.session.clear()
    request.session["role"] = "student"
    request.session["id"] = student.id
    return StudentPublic(id=student.id, classId=student.classId, displayName=student.displayName)


@router.post("/auth/student/login", response_model=StudentPublic)
def login_student(body: StudentLoginRequest, request: Request) -> StudentPublic:
    student = auth_service.authenticate_student(body.classCode, body.displayName, body.pin)
    if student is None:
        raise HTTPException(status_code=401, detail="Invalid class code, name, or PIN")

    request.session.clear()
    request.session["role"] = "student"
    request.session["id"] = student.id
    return StudentPublic(id=student.id, classId=student.classId, displayName=student.displayName)


@router.post("/auth/logout")
def logout(request: Request) -> dict:
    request.session.clear()
    return {"ok": True}


@router.post("/auth/learner/start", response_model=CurrentUser)
def start_self_serve_learner(request: Request) -> CurrentUser:
    """
    Establishes a self-serve learner session. Idempotent by construction: if
    the caller already holds a valid student-role session (either an existing
    SelfServeLearner or a class-connected Student - a student who's already
    logged in has no reason to get a second, disconnected identity), that
    identity is returned unchanged and no new learner is created. Only when
    there is no appropriate existing session does this mint a new learner.
    This guards the "repeated initialization must not create duplicate
    learners" requirement at the backend layer, independent of whatever
    frontend caller discipline also exists.
    """
    existing_role = request.session.get("role")
    existing_id = request.session.get("id")

    if existing_role == "student" and existing_id:
        student = auth_service.get_student(existing_id)
        if student is not None:
            return CurrentUser(role="student", id=student.id, name=student.displayName)

        learner = auth_service.get_self_serve_learner(existing_id)
        if learner is not None:
            return CurrentUser(role="student", id=learner.id, name=None)

    learner = auth_service.create_self_serve_learner()
    request.session.clear()
    request.session["role"] = "student"
    request.session["id"] = learner.id
    return CurrentUser(role="student", id=learner.id, name=None)


@router.get("/auth/me", response_model=CurrentUser)
def get_current_user(request: Request) -> CurrentUser:
    role = request.session.get("role")
    user_id = request.session.get("id")
    if role is None or user_id is None:
        raise HTTPException(status_code=401, detail="Not logged in")

    if role == "teacher":
        teacher = auth_service.get_teacher(user_id)
        if teacher is None:
            request.session.clear()
            raise HTTPException(status_code=401, detail="Not logged in")
        return CurrentUser(role="teacher", id=teacher.id, name=teacher.name)

    # Student-role session: try the class-connected Student store first, then
    # the self-serve learner store. Order is safe regardless of which is
    # checked first - ids are structurally disjoint (Student ids are plain
    # uuid4().hex; SelfServeLearner ids always carry the "learner_" prefix,
    # see auth_service.py) - so a lookup can never resolve the wrong identity
    # even if both stores happened to be searched.
    student = auth_service.get_student(user_id)
    if student is not None:
        return CurrentUser(role="student", id=student.id, name=student.displayName)

    learner = auth_service.get_self_serve_learner(user_id)
    if learner is not None:
        return CurrentUser(role="student", id=learner.id, name=None)

    request.session.clear()
    raise HTTPException(status_code=401, detail="Not logged in")
