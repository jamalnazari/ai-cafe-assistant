"""تست‌های مدیریت کلیدهای هوش مصنوعی و مسابقهٔ پاسخ (RacingLLMProvider)."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.providers.llm import LLMUnavailableError, RacingLLMProvider
from main import app

ADMIN_USERNAME = "jamal"
ADMIN_PASSWORD = "Jamal@1381"


@pytest.fixture
def admin_client(tmp_path, monkeypatch):
    """کلاینت تست با دیتابیس تازه؛ seed از .env غیرفعال تا تست‌ها قطعی باشند."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.core.security import hash_password
    from app.db.session import Base, get_db
    from app.models.user import UserModel

    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'keys.db'}")
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def setup_database() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with session_factory() as session:
            session.add(
                UserModel(
                    username=ADMIN_USERNAME,
                    email="admin@example.com",
                    password_hash=hash_password(ADMIN_PASSWORD),
                    role="admin",
                    is_owner=True,
                    is_active=True,
                )
            )
            await session.commit()

    asyncio.run(setup_database())

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    # seed از .env واقعی نباید نتیجهٔ تست‌ها را غیرقطعی کند.
    monkeypatch.setattr(app_module(), "seed_llm_keys_from_env", _noop_seed)

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def app_module():
    import main

    return main


async def _noop_seed(_session) -> None:
    return None


def login(client: TestClient, username: str = ADMIN_USERNAME, password: str = ADMIN_PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )


def test_llm_keys_require_admin(admin_client):
    client = admin_client
    assert client.get("/api/v1/admin/llm-keys").status_code == 401
    assert client.post("/api/v1/admin/llm-keys", json={}).status_code in {401, 422}


def test_admin_can_create_list_and_masked_key(admin_client):
    client = admin_client
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    response = client.post(
        "/api/v1/admin/llm-keys",
        json={
            "label": "gapgpt",
            "base_url": "https://api.gapgpt.app/v1/",
            "api_key": "sk-test-key-1234567890",
            "model": "gpt-4o",
        },
    )
    assert response.status_code == 200
    created = response.json()
    assert created["label"] == "gapgpt"
    # اسلش انتهایی نشانی پاک می‌شود.
    assert created["base_url"] == "https://api.gapgpt.app/v1"
    # کلید کامل هرگز برنمی‌گردد.
    assert "sk-test-key-1234567890" not in response.text
    assert created["api_key_masked"].startswith("sk-test-")
    assert created["api_key_masked"].endswith("7890")

    listing = client.get("/api/v1/admin/llm-keys").json()
    # پرچم مسابقه از تنظیمات محیط می‌آید (تست‌ها با هر .env قابل اجرا هستند).
    from app.core.config import settings as app_settings

    assert listing["racing_enabled"] == (app_settings.LLM_PROVIDER != "mock")
    assert len(listing["keys"]) == 1
    assert listing["keys"][0]["is_active"] is True


def test_create_rejects_invalid_base_url(admin_client):
    client = admin_client
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    response = client.post(
        "/api/v1/admin/llm-keys",
        json={"base_url": "ftp://bad.example", "api_key": "sk-12345678"},
    )
    assert response.status_code == 422


def test_admin_can_edit_and_toggle_key(admin_client):
    client = admin_client
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    created = client.post(
        "/api/v1/admin/llm-keys",
        json={"label": "اولیه", "base_url": "https://a.example.com/v1", "api_key": "sk-aaaaaaaa1234"},
    ).json()

    # ویرایش برچسب و مدل؛ بدون ارسال api_key یعنی همان کلید قبلی بماند.
    updated = client.patch(
        f"/api/v1/admin/llm-keys/{created['id']}",
        json={"label": "داهل", "model": "dahl-model", "api_key": ""},
    )
    assert updated.status_code == 200
    assert updated.json()["label"] == "داهل"
    assert updated.json()["model"] == "dahl-model"

    # غیرفعال‌سازی
    toggled = client.patch(
        f"/api/v1/admin/llm-keys/{created['id']}", json={"is_active": False}
    )
    assert toggled.status_code == 200
    assert toggled.json()["is_active"] is False


def test_admin_can_delete_key(admin_client):
    client = admin_client
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    created = client.post(
        "/api/v1/admin/llm-keys",
        json={"base_url": "https://x.example.com/v1", "api_key": "sk-zzzzzzzz1234"},
    ).json()

    assert client.delete(f"/api/v1/admin/llm-keys/{created['id']}").status_code == 200
    assert client.get("/api/v1/admin/llm-keys").json()["keys"] == []
    assert client.delete(f"/api/v1/admin/llm-keys/{created['id']}").status_code == 404


# --- تست‌های مسابقهٔ پاسخ ---


class _FakeProvider:
    def __init__(self, delay: float, answer: str | None, error: Exception | None = None):
        self.delay = delay
        self.answer = answer
        self.error = error

    async def generate_response(self, system_prompt, user_question, history=None):
        await asyncio.sleep(self.delay)
        if self.error is not None:
            raise self.error
        return self.answer  # type: ignore[return-value]


def test_racing_returns_fastest_successful_answer():
    slow = _FakeProvider(0.3, "پاسخ کند")
    fast = _FakeProvider(0.01, "پاسخ سریع")
    provider = RacingLLMProvider([slow, fast], ["کند", "سریع"])

    result = asyncio.run(
        provider.generate_response("system", "سؤال مشتری")
    )
    assert result == "پاسخ سریع"


def test_racing_skips_failing_fast_provider():
    # سریع‌ترین کلید خطا می‌دهد؛ پاسخ باید از دومین کلیدِ موفق بیاید.
    broken_fast = _FakeProvider(0.01, None, error=LLMUnavailableError("کلید باطل"))
    slow_ok = _FakeProvider(0.1, "پاسخ سالم")
    provider = RacingLLMProvider([broken_fast, slow_ok], ["خراب", "سالم"])

    result = asyncio.run(
        provider.generate_response("system", "سؤال مشتری")
    )
    assert result == "پاسخ سالم"


def test_racing_raises_when_all_fail():
    provider = RacingLLMProvider(
        [
            _FakeProvider(0.01, None, error=LLMUnavailableError("الف")),
            _FakeProvider(0.01, None, error=LLMUnavailableError("ب")),
        ],
        ["الف", "ب"],
    )
    with pytest.raises(LLMUnavailableError):
        asyncio.run(provider.generate_response("system", "سؤال"))


def test_racing_works_with_concurrent_calls():
    """چند مشتری هم‌زمان، هر کدام مسابقهٔ مستقل خودشان."""
    provider = RacingLLMProvider(
        [_FakeProvider(0.05, "آهسته"), _FakeProvider(0.01, "سریع")],
        ["آهسته", "سریع"],
    )

    async def run_many() -> list[str]:
        results = await asyncio.gather(
            *[
                provider.generate_response("system", f"سؤال {index}")
                for index in range(8)
            ]
        )
        return results

    assert asyncio.run(run_many()) == ["سریع"] * 8
