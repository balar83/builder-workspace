import json
import secrets
import string
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path

import bcrypt

from app.schemas.user import ClassGroup, SelfServeLearner, Student, Teacher

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEACHERS_PATH = DATA_DIR / "teachers.json"
CLASSES_PATH = DATA_DIR / "classes.json"
STUDENTS_PATH = DATA_DIR / "students.json"
# Separate store on purpose - a SelfServeLearner is not a class-membership
# record (see SelfServeLearner's own docstring). Same file-store convention
# (_read_store/_write_store) as teachers/classes/students.
LEARNERS_PATH = DATA_DIR / "learners.json"

# Student/Teacher ids are plain uuid4().hex (32 lowercase hex chars, never
# containing "_"). Prefixing self-serve learner ids makes the two id spaces
# structurally disjoint - not just collision-improbable - so any future
# lookup can tell the two apart by construction, not by hoping a 128-bit
# random value never collides.
_LEARNER_ID_PREFIX = "learner_"

_lock = threading.Lock()

CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")


def _read_store(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_store(path: Path, items: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(path)


def _hash_secret(secret: str) -> str:
    return bcrypt.hashpw(secret.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_secret(secret: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(secret.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def register_teacher(email: str, password: str, name: str) -> Teacher:
    normalized_email = email.strip().lower()
    if "@" not in normalized_email or len(normalized_email) < 5:
        raise ValueError("Enter a valid email address")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    with _lock:
        teachers = _read_store(TEACHERS_PATH)
        if any(t["email"] == normalized_email for t in teachers):
            raise ValueError("Email already registered")

        teacher = Teacher(
            id=uuid.uuid4().hex,
            email=normalized_email,
            name=name.strip(),
            passwordHash=_hash_secret(password),
        )
        teachers.append(teacher.model_dump())
        _write_store(TEACHERS_PATH, teachers)
        return teacher


def authenticate_teacher(email: str, password: str) -> Teacher | None:
    normalized_email = email.strip().lower()
    teachers = _read_store(TEACHERS_PATH)
    record = next((t for t in teachers if t["email"] == normalized_email), None)
    if record is None:
        return None
    if not _verify_secret(password, record["passwordHash"]):
        return None
    return Teacher(**record)


def get_teacher(teacher_id: str) -> Teacher | None:
    teachers = _read_store(TEACHERS_PATH)
    record = next((t for t in teachers if t["id"] == teacher_id), None)
    return Teacher(**record) if record else None


def _generate_class_code(existing_codes: set[str]) -> str:
    for _ in range(50):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        if code not in existing_codes:
            return code
    raise RuntimeError("Could not generate a unique class code")


def create_class(teacher_id: str, name: str) -> ClassGroup:
    if not name.strip():
        raise ValueError("Class name is required")

    with _lock:
        classes = _read_store(CLASSES_PATH)
        existing_codes = {c["code"] for c in classes}
        class_group = ClassGroup(
            id=uuid.uuid4().hex,
            teacherId=teacher_id,
            name=name.strip(),
            code=_generate_class_code(existing_codes),
        )
        classes.append(class_group.model_dump())
        _write_store(CLASSES_PATH, classes)
        return class_group


def get_class_by_code(code: str) -> ClassGroup | None:
    classes = _read_store(CLASSES_PATH)
    record = next((c for c in classes if c["code"] == code.strip().upper()), None)
    return ClassGroup(**record) if record else None


def get_class(class_id: str) -> ClassGroup | None:
    classes = _read_store(CLASSES_PATH)
    record = next((c for c in classes if c["id"] == class_id), None)
    return ClassGroup(**record) if record else None


def join_class(class_code: str, display_name: str, pin: str) -> Student:
    class_group = get_class_by_code(class_code)
    if class_group is None:
        raise ValueError("Class code not found")
    if not display_name.strip():
        raise ValueError("Display name is required")
    if len(pin) < 4 or not pin.isdigit():
        raise ValueError("PIN must be at least 4 digits")

    with _lock:
        students = _read_store(STUDENTS_PATH)
        normalized_name = display_name.strip().lower()
        if any(
            s["classId"] == class_group.id and s["displayName"].lower() == normalized_name
            for s in students
        ):
            raise ValueError("That name is already taken in this class — pick another")

        student = Student(
            id=uuid.uuid4().hex,
            classId=class_group.id,
            displayName=display_name.strip(),
            pinHash=_hash_secret(pin),
        )
        students.append(student.model_dump())
        _write_store(STUDENTS_PATH, students)
        return student


def authenticate_student(class_code: str, display_name: str, pin: str) -> Student | None:
    class_group = get_class_by_code(class_code)
    if class_group is None:
        return None

    normalized_name = display_name.strip().lower()
    students = _read_store(STUDENTS_PATH)
    record = next(
        (
            s
            for s in students
            if s["classId"] == class_group.id and s["displayName"].lower() == normalized_name
        ),
        None,
    )
    if record is None:
        return None
    if not _verify_secret(pin, record["pinHash"]):
        return None
    return Student(**record)


def get_student(student_id: str) -> Student | None:
    students = _read_store(STUDENTS_PATH)
    record = next((s for s in students if s["id"] == student_id), None)
    return Student(**record) if record else None


def create_self_serve_learner() -> SelfServeLearner:
    """
    Mint-only - no credential is collected or checked, deliberately (see
    SelfServeLearner's docstring). Callers are responsible for not calling this
    more than once per browser/session; routes/auth.py's start route guards
    this by checking for an existing valid session first.
    """
    with _lock:
        learners = _read_store(LEARNERS_PATH)
        learner = SelfServeLearner(
            id=f"{_LEARNER_ID_PREFIX}{uuid.uuid4().hex}",
            createdAt=datetime.now(UTC).isoformat(),
        )
        learners.append(learner.model_dump())
        _write_store(LEARNERS_PATH, learners)
        return learner


def get_self_serve_learner(learner_id: str) -> SelfServeLearner | None:
    learners = _read_store(LEARNERS_PATH)
    record = next((item for item in learners if item["id"] == learner_id), None)
    return SelfServeLearner(**record) if record else None
