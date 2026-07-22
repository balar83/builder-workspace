"""Minimal Ollama HTTP client for the AI evaluation spike.

Standalone by design: this talks to a local Ollama server directly over
HTTP and is not imported by any app.* module. Replaceable later without
touching production code.
"""

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"

DETERMINISTIC_OPTIONS = {
    "temperature": 0,
    "seed": 42,
}


def generate(model: str, prompt: str, timeout: float = 180.0) -> dict:
    """Call Ollama's /api/generate and return the raw response envelope."""
    response = httpx.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": DETERMINISTIC_OPTIONS,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()
