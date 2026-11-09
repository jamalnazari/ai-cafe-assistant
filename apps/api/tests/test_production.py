"""تست‌های آماده‌سازی production: پیکربندی، محدودیت نرخ، health و خطای LLM."""

import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import main
from app.core.config import DEFAULT_SECRET_KEY, Settings, settings
from app.core.rate_limit import ASK_LIMIT_MESSAGE, LOGIN_LIMIT_MESSAGE, reset_rate_limits
from app.core.security import hash_password
from app.db.session import Base, get_db
from app.models import RestaurantModel, UserModel
from app.providers.llm import LLMUnavailableError, OpenAICompatibleLLMProvider


@pytest.fixture
def production_client(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'prod-test.db'}")
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def setup_database() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with session_factory() as session:
            session.add_all(
                [
                    UserModel(
                        email="owner@cafe.com",
                        password_hash=hash_password("correct-horse"),
                        is_owner=True,
                    ),
                    RestaurantModel(slug="demo", name="کافه آزمایشی"),
                ]
            )
            await session.commit()

    asyncio.run(setup_database())

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app = main.app
    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(settings, "SESSION_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT", 2)
    monkeypatch.setattr(settings, "LOGIN_RATE_WINDOW_SECONDS", 300)
    monkeypatch.setattr(settings, "ASK_RATE_LIMIT", 2)
    monkeypatch.setattr(settings, "ASK_RATE_WINDOW_SECONDS", 60)
    reset_rate_limits()

    with TestClient(app, base_url="https://testserver") as client:
        yield client

    app.dependency_overrides.clear()
    reset_rate_limits()
    asyncio.run(engine.dispose())


# --- بررسی سلامت ---


def test_health_reports_database_status(production_client):
    response = production_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


# --- محدودیت نرخ ---


def test_login_rate_limit_blocks_bruteforce_with_persian_message(production_client):
    for _ in range(2):
        response = production_client.post(
            "/api/v1/auth/login",
            json={"email": "owner@cafe.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = production_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@cafe.com", "password": "wrong-password"},
    )

    assert blocked.status_code == 429
    assert blocked.json()["detail"] == LOGIN_LIMIT_MESSAGE
    assert int(blocked.headers["Retry-After"]) >= 1


def test_ask_rate_limit_blocks_extra_questions(production_client):
    for _ in range(2):
        response = production_client.post(
            "/api/v1/restaurants/demo/ask-text", json={"question": "لاته چقدر است؟"}
        )
        assert response.status_code == 200

    blocked = production_client.post(
        "/api/v1/restaurants/demo/ask-text", json={"question": "دوباره می‌پرسم"}
    )

    assert blocked.status_code == 429
    assert blocked.json()["detail"] == ASK_LIMIT_MESSAGE


def test_rate_limit_can_be_disabled(production_client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    reset_rate_limits()

    for _ in range(5):
        response = production_client.post(
            "/api/v1/auth/login",
            json={"email": "owner@cafe.com", "password": "wrong-password"},
        )
        assert response.status_code == 401


# --- خطاهای فارسی ---


def test_unknown_restaurant_returns_persian_error(production_client):
    response = production_client.get("/api/v1/restaurants/unknown/menu")

    assert response.status_code == 404
    assert response.json()["detail"] == "کافه یافت نشد."


def test_llm_outage_returns_503_with_persian_message(production_client, monkeypatch):
    class FailingProvider:
        async def generate_response(self, system_prompt, user_question, history=None):
            raise LLMUnavailableError("سرویس در دسترس نیست")

    monkeypatch.setattr(main.assistant_service, "llm_provider", FailingProvider())

    response = production_client.post(
        "/api/v1/restaurants/demo/ask-text", json={"question": "چه چیزی شیرین دارید؟"}
    )

    assert response.status_code == 503
    assert "موقتاً در دسترس نیست" in response.json()["detail"]


# --- پیکربندی production ---


def test_production_hides_api_docs():
    production_settings = Settings(
        _env_file=None, ENVIRONMENT="production", SECRET_KEY="x" * 48
    )

    assert production_settings.docs_url is None
    assert production_settings.redoc_url is None
    assert production_settings.openapi_url is None
    assert production_settings.session_cookie_secure is True


def test_development_keeps_docs_and_console_cookie():
    development_settings = Settings(_env_file=None, ENVIRONMENT="development")

    assert development_settings.docs_url == "/docs"
    assert development_settings.session_cookie_secure is False


def test_production_rejects_default_secret_key():
    unsafe_settings = Settings(
        _env_file=None, ENVIRONMENT="production", SECRET_KEY=DEFAULT_SECRET_KEY
    )

    with pytest.raises(RuntimeError) as error:
        unsafe_settings.validate_startup()

    assert "SECRET_KEY" in str(error.value)


def test_production_rejects_real_llm_without_api_key():
    unsafe_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="x" * 48,
        LLM_PROVIDER="openai",
        AI_API_KEY="mock-key",
    )

    with pytest.raises(RuntimeError) as error:
        unsafe_settings.validate_startup()

    assert "AI_API_KEY" in str(error.value)


def test_production_accepts_safe_settings():
    safe_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="x" * 48,
        LLM_PROVIDER="openai",
        AI_API_KEY="sk-real-key",
        AI_BASE_URL="https://api.routeway.ai/v1",
    )

    safe_settings.validate_startup()


def test_development_only_warns_about_default_secret():
    Settings(_env_file=None, ENVIRONMENT="development").validate_startup()


def test_session_cookie_secure_can_be_overridden():
    production_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="x" * 48,
        SESSION_COOKIE_SECURE=False,
    )

    assert production_settings.session_cookie_secure is False


def test_allowed_hosts_parsing():
    parsed = Settings(
        _env_file=None, ALLOWED_HOSTS="cafe.example.com, localhost ,127.0.0.1"
    )

    assert parsed.allowed_hosts == ["cafe.example.com", "localhost", "127.0.0.1"]


# --- مقاومت آداپتور LLM ---


@pytest.mark.asyncio
async def test_llm_provider_retries_transient_errors(monkeypatch):
    attempts = {"count": 0}

    async def failing_post(self, url, **kwargs):
        attempts["count"] += 1
        raise httpx.ConnectError("اتصال برقرار نشد", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", failing_post)
    monkeypatch.setattr("asyncio.sleep", _instant_sleep)

    provider = OpenAICompatibleLLMProvider(
        base_url="https://example.test/v1",
        api_key="key",
        model="model",
        timeout_seconds=1.0,
        max_retries=2,
    )

    with pytest.raises(LLMUnavailableError):
        await provider.generate_response("system", "question")

    assert attempts["count"] == 3


@pytest.mark.asyncio
async def test_llm_provider_does_not_retry_auth_errors(monkeypatch):
    attempts = {"count": 0}

    async def unauthorized_post(self, url, **kwargs):
        attempts["count"] += 1
        request = httpx.Request("POST", url)
        response = httpx.Response(401, request=request, text="unauthorized")
        raise httpx.HTTPStatusError("unauthorized", request=request, response=response)

    monkeypatch.setattr(httpx.AsyncClient, "post", unauthorized_post)

    provider = OpenAICompatibleLLMProvider(
        base_url="https://example.test/v1",
        api_key="key",
        model="model",
        timeout_seconds=1.0,
        max_retries=3,
    )

    with pytest.raises(LLMUnavailableError):
        await provider.generate_response("system", "question")

    assert attempts["count"] == 1


async def _instant_sleep(_seconds):
    return None
