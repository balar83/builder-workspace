import importlib
from pathlib import Path

import pytest

from app.services import attempt_service, auth_service, question_service, session_store, topic_service


def test_data_dir_env_var_override_is_respected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    override = tmp_path / "custom-data-dir"
    monkeypatch.setenv("DATA_DIR", str(override))

    try:
        importlib.reload(session_store)
        importlib.reload(attempt_service)

        assert session_store.DATA_DIR == override
        assert session_store.DB_PATH == override / "runtime.db"
        assert attempt_service.DATA_DIR == override
        assert attempt_service.DB_PATH == override / "runtime.db"
    finally:
        # Restore both modules to their default (env-unset) state so later
        # tests in the same process aren't left pointed at this tmp_path.
        monkeypatch.delenv("DATA_DIR", raising=False)
        importlib.reload(session_store)
        importlib.reload(attempt_service)


def test_account_stores_follow_data_dir_env_var(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    The four account stores are mutable runtime state, exactly like
    runtime.db, so they must land on the same overridable DATA_DIR. Before
    this, they were pinned next to the code - ephemeral storage on a
    deployment with a mounted disk - so every deploy silently deleted every
    teacher, class, student and self-serve learner while their attempts
    survived in runtime.db, orphaned.
    """
    override = tmp_path / "custom-data-dir"
    monkeypatch.setenv("DATA_DIR", str(override))

    try:
        importlib.reload(auth_service)

        assert auth_service.DATA_DIR == override
        assert auth_service.TEACHERS_PATH == override / "teachers.json"
        assert auth_service.CLASSES_PATH == override / "classes.json"
        assert auth_service.STUDENTS_PATH == override / "students.json"
        assert auth_service.LEARNERS_PATH == override / "learners.json"
    finally:
        monkeypatch.delenv("DATA_DIR", raising=False)
        importlib.reload(auth_service)


def test_content_stores_ignore_data_dir_env_var(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    The mirror image of the test above, and the reason it is not "move every
    DATA_DIR to the env var": chapters/questions/topics are read-only files
    shipped with the code, never runtime state. Pointing them at a mounted
    disk would serve an empty curriculum.
    """
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "custom-data-dir"))
    code_data_dir = Path(question_service.__file__).resolve().parent.parent / "data"

    try:
        importlib.reload(question_service)
        importlib.reload(topic_service)

        assert question_service.DATA_DIR == code_data_dir
        assert topic_service.DATA_DIR == code_data_dir
    finally:
        monkeypatch.delenv("DATA_DIR", raising=False)
        importlib.reload(question_service)
        importlib.reload(topic_service)
