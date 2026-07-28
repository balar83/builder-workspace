from unittest.mock import Mock

import httpx
import pytest

from app.core.config import settings
from app.services import ai_evaluation_client


def _mock_response(status_code: int, json_data: dict) -> Mock:
    response = Mock()
    response.status_code = status_code
    response.json.return_value = json_data
    if status_code >= 400:
        request = httpx.Request("POST", settings.shadow_ollama_url)
        error_response = httpx.Response(status_code, request=request)
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=request, response=error_response
        )
    else:
        response.raise_for_status.return_value = None
    return response


def test_generate_sends_expected_request_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_post = Mock(return_value=_mock_response(200, {"response": "{}"}))
    monkeypatch.setattr(httpx, "post", mock_post)

    result = ai_evaluation_client.generate("qwen2.5:7b-instruct", "evaluate this answer")

    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert args[0] == settings.shadow_ollama_url
    assert kwargs["json"] == {
        "model": "qwen2.5:7b-instruct",
        "prompt": "evaluate this answer",
        "format": "json",
        "stream": False,
        "options": {"temperature": 0, "seed": 42},
    }
    assert result == {"response": "{}"}


def test_generate_uses_configured_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_post = Mock(return_value=_mock_response(200, {"response": "{}"}))
    monkeypatch.setattr(httpx, "post", mock_post)

    ai_evaluation_client.generate("qwen2.5:7b-instruct", "evaluate this answer")

    assert mock_post.call_args.kwargs["timeout"] == settings.shadow_timeout_seconds


def test_generate_raises_on_non_200_response(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_post = Mock(return_value=_mock_response(500, {}))
    monkeypatch.setattr(httpx, "post", mock_post)

    with pytest.raises(httpx.HTTPStatusError):
        ai_evaluation_client.generate("qwen2.5:7b-instruct", "evaluate this answer")
