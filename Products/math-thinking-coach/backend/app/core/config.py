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
    session_secret_key: str = os.getenv("SESSION_SECRET_KEY", "dev-only-insecure-secret-change-me")
    # Comma-separated list; unset preserves the exact prior hardcoded behavior
    # (local Vite dev server only).
    allowed_origins: list[str] = [
        origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if origin.strip()
    ]
    session_https_only: bool = os.getenv("SESSION_HTTPS_ONLY", "false").lower() == "true"
    # "lax" (default) works for same-site deployments (self-hosted-behind-one-origin,
    # local dev). Split hosting (frontend and backend on different domains, e.g.
    # Vercel + Render) is cross-site and needs "none" here, paired with
    # SESSION_HTTPS_ONLY=true — browsers reject SameSite=None without Secure.
    session_cookie_samesite: str = os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower()


settings = Settings()

if settings.session_cookie_samesite == "none" and not settings.session_https_only:
    raise RuntimeError(
        "SESSION_COOKIE_SAMESITE=none requires SESSION_HTTPS_ONLY=true"
    )
