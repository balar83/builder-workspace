import json
import threading
from pathlib import Path

import pytest

from app.core.config import settings
from app.services import shadow_log_writer


def test_append_record_writes_a_single_valid_jsonl_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    shadow_log_writer.append_record({"questionId": "q1", "latencySeconds": 1.5})

    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == {"questionId": "q1", "latencySeconds": 1.5}


def test_append_record_appends_without_overwriting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    shadow_log_writer.append_record({"questionId": "q1"})
    shadow_log_writer.append_record({"questionId": "q2"})

    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert json.loads(lines[0]) == {"questionId": "q1"}
    assert json.loads(lines[1]) == {"questionId": "q2"}


def test_concurrent_appends_produce_non_corrupted_lines(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    log_path = tmp_path / "shadow_eval_log.jsonl"
    monkeypatch.setattr(settings, "shadow_log_path", str(log_path))

    thread_count = 20

    def write_record(index: int) -> None:
        shadow_log_writer.append_record({"questionId": f"q{index}"})

    threads = [threading.Thread(target=write_record, args=(i,)) for i in range(thread_count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == thread_count

    parsed_ids = {json.loads(line)["questionId"] for line in lines}
    assert parsed_ids == {f"q{i}" for i in range(thread_count)}
