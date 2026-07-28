import httpx

from app.core.config import settings

DETERMINISTIC_OPTIONS = {
    "temperature": 0,
    "seed": 42,
}


def generate(model: str, prompt: str) -> dict:
    response = httpx.post(
        settings.shadow_ollama_url,
        json={
            "model": model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": DETERMINISTIC_OPTIONS,
        },
        timeout=settings.shadow_timeout_seconds,
    )
    response.raise_for_status()
    return response.json()
