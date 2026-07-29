import importlib
from pathlib import Path

import pytest

from app.services import attempt_service, session_store


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
