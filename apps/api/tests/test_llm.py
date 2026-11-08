import httpx
import pytest

from app.providers.llm import OpenAICompatibleLLMProvider


@pytest.mark.asyncio
async def test_openai_compatible_provider_sends_conversation_history(monkeypatch):
    captured_request = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": " پاسخ جدید "}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, headers: dict, json: dict) -> FakeResponse:
            captured_request["url"] = url
            captured_request["headers"] = headers
            captured_request["json"] = json
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    provider = OpenAICompatibleLLMProvider(
        base_url="https://provider.example/v1/",
        api_key="test-key",
        model="test-model",
    )

    answer = await provider.generate_response(
        "system prompt",
        "قیمتش چقدر است؟",
        [("لاته چه ترکیباتی دارد؟", "لاته اسپرسو و شیر دارد.")],
    )

    assert answer == "پاسخ جدید"
    assert captured_request["url"] == "https://provider.example/v1/chat/completions"
    assert captured_request["json"]["messages"] == [
        {"role": "system", "content": "system prompt"},
        {"role": "user", "content": "لاته چه ترکیباتی دارد؟"},
        {"role": "assistant", "content": "لاته اسپرسو و شیر دارد."},
        {"role": "user", "content": "قیمتش چقدر است؟"},
    ]
