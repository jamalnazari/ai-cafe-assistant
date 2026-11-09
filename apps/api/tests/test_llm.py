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
    # سرویس‌های سازگار با OpenAI باید بدنهٔ استاندارد و non-stream بگیرند.
    assert captured_request["json"]["stream"] is False
    assert "temperature" in captured_request["json"]
    assert captured_request["headers"]["Authorization"] == "Bearer test-key"
    assert captured_request["json"]["messages"] == [
        {"role": "system", "content": "system prompt"},
        {"role": "user", "content": "لاته چه ترکیباتی دارد؟"},
        {"role": "assistant", "content": "لاته اسپرسو و شیر دارد."},
        {"role": "user", "content": "قیمتش چقدر است؟"},
    ]


@pytest.mark.asyncio
async def test_provider_falls_back_to_reasoning_content(monkeypatch):
    """بعضی مدل‌های استدلالی پاسخ را در reasoning_content می‌گذارند."""

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "choices": [
                    {
                        "message": {
                            "content": None,
                            "reasoning_content": "  اتصال برقرار است.  ",
                        }
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, headers: dict, json: dict) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    provider = OpenAICompatibleLLMProvider(
        base_url="https://inference.dahl.global/v1",
        api_key="test-key",
        model="deepseek-v4",
    )

    answer = await provider.generate_response("system", "سلام")

    assert answer == "اتصال برقرار است."


@pytest.mark.asyncio
async def test_provider_uses_configured_temperature(monkeypatch):
    from app.core.config import settings

    captured = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": "باشه"}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, headers: dict, json: dict) -> FakeResponse:
            captured.update(json)
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(settings, "AI_TEMPERATURE", 0.7)

    provider = OpenAICompatibleLLMProvider(
        base_url="https://inference.dahl.global/v1",
        api_key="test-key",
        model="zai-org/GLM-5.3-Flash",
    )
    await provider.generate_response("system", "سلام")

    assert captured["temperature"] == 0.7
    assert captured["model"] == "zai-org/GLM-5.3-Flash"


def test_check_llm_hints_and_key_masking():
    import httpx as httpx_module

    from app.core.check_llm import mask, provider_hint
    from app.providers.llm import LLMUnavailableError

    assert mask("sk-1234567890") == "sk-1…90"
    assert mask("") == "(خالی)"

    request = httpx_module.Request("POST", "https://inference.dahl.global/v1/chat/completions")
    unauthorized = httpx_module.HTTPStatusError(
        "unauthorized",
        request=request,
        response=httpx_module.Response(401, request=request),
    )
    missing_model = httpx_module.HTTPStatusError(
        "not found",
        request=request,
        response=httpx_module.Response(404, request=request),
    )

    error_401 = LLMUnavailableError("سرویس در دسترس نیست.")
    error_401.__cause__ = unauthorized
    assert "AI_API_KEY" in provider_hint(error_401)

    error_404 = LLMUnavailableError("سرویس در دسترس نیست.")
    error_404.__cause__ = missing_model
    assert "LLM_MODEL" in provider_hint(error_404)


@pytest.mark.asyncio
async def test_check_llm_reports_success(monkeypatch, capsys):
    from app.core import check_llm
    from app.core.config import settings

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": "اتصال برقرار است."}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def post(self, url: str, headers: dict, json: dict) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(settings, "LLM_PROVIDER", "dahl")
    monkeypatch.setattr(settings, "AI_BASE_URL", "https://inference.dahl.global/v1")
    monkeypatch.setattr(settings, "LLM_MODEL", "zai-org/GLM-5.3-Flash")
    monkeypatch.setattr(settings, "AI_API_KEY", "test-key-123456")

    exit_code = await check_llm.run("سلام")

    output = capsys.readouterr().out
    assert exit_code == 0
    assert "اتصال برقرار است" in output
    assert "zai-org/GLM-5.3-Flash" in output
