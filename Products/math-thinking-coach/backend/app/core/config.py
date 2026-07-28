import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name: str = os.getenv("APP_NAME", "Math Thinking Coach API")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    api_prefix: str = os.getenv("API_PREFIX", "/api/v1")
    shadow_ollama_url: str = os.getenv("SHADOW_OLLAMA_URL", "http://localhost:11434/api/generate")
    shadow_timeout_seconds: float = float(os.getenv("SHADOW_TIMEOUT_SECONDS", "90"))
    shadow_model_name: str = os.getenv("SHADOW_MODEL_NAME", "qwen2.5:7b-instruct")
    shadow_log_path: str = os.getenv("SHADOW_LOG_PATH", "app/data/shadow_log/shadow_eval_log.jsonl")
    shadow_mode_enabled: bool = os.getenv("SHADOW_MODE_ENABLED", "true").lower() == "true"


settings = Settings()
