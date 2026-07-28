import json
import threading
from pathlib import Path

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

_lock = threading.Lock()


def append_record(record: dict) -> None:
    log_path = BACKEND_DIR / settings.shadow_log_path

    with _lock:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(record) + "\n")
