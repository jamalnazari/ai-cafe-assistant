import asyncio
import base64
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.security import hash_password, hash_session_token
from app.db.session import get_db
from app.models import (
    AuthSessionModel,
    Base,
    MenuCategoryModel,
    MenuItemModel,
    RestaurantModel,
    UserModel,
)
from app.services.menu_image_service import menu_image_service
from app.services.menu_recommendation import find_mentioned_items
from app.schemas.menu import MenuItem, Price, RestaurantMenu
from main import app, assistant_service


PNG_IMAGE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@dataclass
class AuthTestContext:
    client: TestClient
    session_factory: async_sessionmaker[AsyncSession]


@pytest.fixture
def auth_context(tmp_path, monkeypatch) -> AuthTestContext:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'auth-test.db'}"
    engine = create_async_engine(database_url)
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
                        password_hash=hash_password("123456"),
                        is_owner=True,
                    ),
                    UserModel(
                        email="staff@cafe.com",
                        password_hash=hash_password("123456"),
                        is_owner=False,
                    ),
                    RestaurantModel(
                        slug="demo",
                        name="کافه آزمایشی",
                        categories=[MenuCategoryModel(name="نوشیدنی گرم")],
                        items=[
                            MenuItemModel(
                                item_key="latte",
                                name="لاته",
                                category="نوشیدنی گرم",
                                description="اسپرسو و شیر",
                                ingredients=["اسپرسو", "شیر"],
                                allergens=["شیر"],
                                price_amount=1450000,
                                price_currency="IRR",
                            )
                        ],
                    ),
                ]
            )
            await session.commit()

    asyncio.run(setup_database())

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(settings, "SESSION_COOKIE_SECURE", True)
    monkeypatch.setattr(menu_image_service, "upload_dir", tmp_path / "uploads")

    with TestClient(app, base_url="https://testserver") as client:
        yield AuthTestContext(client=client, session_factory=session_factory)

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def login(client: TestClient, email: str = "owner@cafe.com"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "123456"},
    )


def new_item_payload() -> dict:
    return {
        "item_key": "flat-white",
        "name": "فلت وایت",
        "category": "نوشیدنی گرم",
        "description": "اسپرسو و شیر",
        "price_amount": 1600000,
    }


def test_menu_mutations_require_authentication(auth_context: AuthTestContext):
    client = auth_context.client

    create_response = client.post(
        "/api/v1/restaurants/demo/items", json=new_item_payload()
    )
    delete_response = client.delete("/api/v1/restaurants/demo/items/latte")
    update_response = client.patch(
        "/api/v1/restaurants/demo/items/latte", json={"name": "لاته ویژه"}
    )
    category_response = client.post(
        "/api/v1/restaurants/demo/categories", json={"name": "دسر"}
    )

    assert create_response.status_code == 401
    assert delete_response.status_code == 401
    assert update_response.status_code == 401
    assert category_response.status_code == 401
    assert "نشست" in create_response.json()["detail"]
    menu_response = client.get("/api/v1/restaurants/demo/menu")
    assert [item["id"] for item in menu_response.json()["items"]] == ["latte"]


def test_login_creates_secure_hashed_session(auth_context: AuthTestContext):
    client = auth_context.client

    response = login(client, "OWNER@cafe.com")

    assert response.status_code == 200
    assert response.json()["email"] == "owner@cafe.com"
    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "Path=/" in set_cookie
    assert "samesite=lax" in set_cookie.lower()

    token = client.cookies.get(settings.SESSION_COOKIE_NAME)
    assert token
    assert client.get("/api/v1/auth/me").json() == {"email": "owner@cafe.com"}

    async def load_sessions() -> list[AuthSessionModel]:
        async with auth_context.session_factory() as session:
            result = await session.execute(select(AuthSessionModel))
            return list(result.scalars().all())

    sessions = asyncio.run(load_sessions())
    assert len(sessions) == 1
    assert sessions[0].token_hash == hash_session_token(token)
    assert sessions[0].token_hash != token


def test_invalid_credentials_and_non_owner_cannot_login(
    auth_context: AuthTestContext,
):
    client = auth_context.client

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@cafe.com", "password": "wrong-password"},
    )
    non_owner = login(client, "staff@cafe.com")

    assert wrong_password.status_code == 401
    assert non_owner.status_code == 401
    assert wrong_password.json()["detail"] == "ایمیل یا رمز عبور اشتباه است."
    assert client.cookies.get(settings.SESSION_COOKIE_NAME) is None
    assert client.get("/api/v1/auth/me").status_code == 401


def test_authenticated_owner_can_create_and_delete_items(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200

    create_response = client.post(
        "/api/v1/restaurants/demo/items", json=new_item_payload()
    )
    assert create_response.status_code == 200
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "flat-white" in [item["id"] for item in menu["items"]]

    delete_response = client.delete(
        "/api/v1/restaurants/demo/items/flat-white"
    )
    assert delete_response.status_code == 200
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "flat-white" not in [item["id"] for item in menu["items"]]


def test_logout_revokes_session_and_clears_cookie(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200
    token = client.cookies.get(settings.SESSION_COOKIE_NAME)

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert client.cookies.get(settings.SESSION_COOKIE_NAME) is None

    # حتی اگر توکن قبلی دوباره دستی ارسال شود، نشست ابطال‌شده معتبر نیست.
    old_session_headers = {
        "Cookie": f"{settings.SESSION_COOKIE_NAME}={token}"
    }
    assert client.get("/api/v1/auth/me", headers=old_session_headers).status_code == 401
    assert (
        client.post(
            "/api/v1/restaurants/demo/items",
            json=new_item_payload(),
            headers=old_session_headers,
        ).status_code
        == 401
    )


def test_expired_session_is_rejected(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200

    async def expire_session() -> None:
        async with auth_context.session_factory() as session:
            await session.execute(
                update(AuthSessionModel).values(
                    expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
                )
            )
            await session.commit()

    asyncio.run(expire_session())

    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/restaurants/demo/items", json=new_item_payload()
        ).status_code
        == 401
    )


def test_menu_item_image_upload_requires_authentication(
    auth_context: AuthTestContext,
):
    response = auth_context.client.post(
        "/api/v1/restaurants/demo/items/latte/image",
        files={"file": ("latte.png", PNG_IMAGE, "image/png")},
    )

    assert response.status_code == 401


def test_owner_can_upload_replace_and_delete_menu_item_image(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200
    image_url = ""

    for _ in range(2):
        response = client.post(
            "/api/v1/restaurants/demo/items/latte/image",
            files={"file": ("latte.png", PNG_IMAGE, "image/png")},
        )
        assert response.status_code == 200
        new_image_url = response.json()["image_url"]
        assert new_image_url.startswith("/api/v1/uploads/menu-items/")
        new_image_path = menu_image_service.upload_dir / new_image_url.rsplit("/", 1)[-1]
        assert new_image_path.is_file()

        if image_url:
            old_image_path = menu_image_service.upload_dir / image_url.rsplit("/", 1)[-1]
            assert not old_image_path.exists()
        image_url = new_image_url

    menu = client.get("/api/v1/restaurants/demo/menu").json()
    latte = next(item for item in menu["items"] if item["id"] == "latte")
    assert latte["image_url"] == image_url

    assert client.delete("/api/v1/restaurants/demo/items/latte").status_code == 200
    assert not (menu_image_service.upload_dir / image_url.rsplit("/", 1)[-1]).exists()


def test_invalid_menu_item_image_is_rejected(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200

    response = client.post(
        "/api/v1/restaurants/demo/items/latte/image",
        files={"file": ("fake.png", b"not-an-image", "image/png")},
    )

    assert response.status_code == 415
    assert "تصویر معتبر" in response.json()["detail"]


def test_owner_can_update_item_and_preserve_unsent_fields(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200
    image_response = client.post(
        "/api/v1/restaurants/demo/items/latte/image",
        files={"file": ("latte.png", PNG_IMAGE, "image/png")},
    )
    image_url = image_response.json()["image_url"]
    category_response = client.post(
        "/api/v1/restaurants/demo/categories", json={"name": "نوشیدنی ویژه"}
    )
    assert category_response.status_code == 200

    response = client.patch(
        "/api/v1/restaurants/demo/items/latte",
        json={
            "name": "لاته ویژه",
            "category": "نوشیدنی ویژه",
            "description": "اسپرسو و شیر بخار داده‌شده",
            "price_amount": 1750000,
            "is_spicy": False,
        },
    )

    assert response.status_code == 200
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    latte = next(item for item in menu["items"] if item["id"] == "latte")
    assert latte["name"] == "لاته ویژه"
    assert latte["category"] == "نوشیدنی ویژه"
    assert latte["description"] == "اسپرسو و شیر بخار داده‌شده"
    assert latte["price"]["amount"] == 1750000
    assert latte["image_url"] == image_url
    assert latte["ingredients"] == ["اسپرسو", "شیر"]
    assert latte["allergens"] == ["شیر"]
    assert latte["is_available"] is True


def test_owner_can_create_category_and_assign_items_to_it(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200

    response = client.post(
        "/api/v1/restaurants/demo/categories", json={"name": "  دسر ویژه  "}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "دسر ویژه"

    duplicate = client.post(
        "/api/v1/restaurants/demo/categories", json={"name": "دسر ویژه"}
    )
    assert duplicate.status_code == 409

    payload = new_item_payload()
    payload["category"] = "دسر ویژه"
    create_response = client.post("/api/v1/restaurants/demo/items", json=payload)
    assert create_response.status_code == 200

    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "دسر ویژه" in menu["categories"]
    created_item = next(item for item in menu["items"] if item["id"] == "flat-white")
    assert created_item["category"] == "دسر ویژه"


def test_item_cannot_use_an_unknown_category(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200
    payload = new_item_payload()
    payload["category"] = "دسته‌بندی نامعتبر"

    response = client.post("/api/v1/restaurants/demo/items", json=payload)

    assert response.status_code == 400
    assert "دسته‌بندی معتبر نیست" in response.json()["detail"]

    update_response = client.patch(
        "/api/v1/restaurants/demo/items/latte",
        json={"category": "دسته‌بندی نامعتبر"},
    )
    assert update_response.status_code == 400
    assert "دسته‌بندی معتبر نیست" in update_response.json()["detail"]


def category_url(name: str) -> str:
    return f"/api/v1/restaurants/demo/categories/{quote(name)}"


def test_category_deletion_requires_authentication(
    auth_context: AuthTestContext,
):
    response = auth_context.client.delete(category_url("نوشیدنی گرم"))

    assert response.status_code == 401


def test_owner_can_delete_an_empty_category(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200
    assert (
        client.post(
            "/api/v1/restaurants/demo/categories", json={"name": "دسر"}
        ).status_code
        == 200
    )

    response = client.delete(category_url("دسر"))

    assert response.status_code == 200
    assert response.json()["message"] == "دسته‌بندی حذف شد."
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "دسر" not in menu["categories"]


def test_deleting_a_category_with_items_needs_a_strategy(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200

    response = client.delete(category_url("نوشیدنی گرم"))

    assert response.status_code == 409
    assert "۱ آیتم" in response.json()["detail"] or "1 آیتم" in response.json()["detail"]
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "نوشیدنی گرم" in menu["categories"]
    assert [item["id"] for item in menu["items"]] == ["latte"]


def test_deleting_a_category_can_move_items_to_another_category(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200
    assert (
        client.post(
            "/api/v1/restaurants/demo/categories", json={"name": "نوشیدنی ویژه"}
        ).status_code
        == 200
    )

    response = client.delete(
        category_url("نوشیدنی گرم"),
        params={"strategy": "move", "move_to": "نوشیدنی ویژه"},
    )

    assert response.status_code == 200
    assert response.json()["moved_to"] == "نوشیدنی ویژه"
    assert response.json()["deleted_item_keys"] == []
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "نوشیدنی گرم" not in menu["categories"]
    assert "نوشیدنی ویژه" in menu["categories"]
    latte = next(item for item in menu["items"] if item["id"] == "latte")
    assert latte["category"] == "نوشیدنی ویژه"


def test_deleting_a_category_can_delete_its_items_and_images(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200
    image_response = client.post(
        "/api/v1/restaurants/demo/items/latte/image",
        files={"file": ("latte.png", PNG_IMAGE, "image/png")},
    )
    image_url = image_response.json()["image_url"]
    image_path = menu_image_service.upload_dir / image_url.rsplit("/", 1)[-1]
    assert image_path.is_file()

    response = client.delete(
        category_url("نوشیدنی گرم"), params={"strategy": "delete_items"}
    )

    assert response.status_code == 200
    assert response.json()["deleted_item_keys"] == ["latte"]
    assert not image_path.exists()
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "نوشیدنی گرم" not in menu["categories"]
    assert menu["items"] == []


def test_move_target_must_be_a_different_existing_category(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200

    missing_target = client.delete(
        category_url("نوشیدنی گرم"), params={"strategy": "move"}
    )
    unknown_target = client.delete(
        category_url("نوشیدنی گرم"),
        params={"strategy": "move", "move_to": "دسته ناموجود"},
    )
    same_target = client.delete(
        category_url("نوشیدنی گرم"),
        params={"strategy": "move", "move_to": "نوشیدنی گرم"},
    )

    assert missing_target.status_code == 400
    assert unknown_target.status_code == 400
    assert same_target.status_code == 400
    menu = client.get("/api/v1/restaurants/demo/menu").json()
    assert "نوشیدنی گرم" in menu["categories"]
    assert [item["id"] for item in menu["items"]] == ["latte"]


def test_deleting_an_unknown_category_returns_not_found(
    auth_context: AuthTestContext,
):
    client = auth_context.client
    assert login(client).status_code == 200

    response = client.delete(category_url("دسته ناموجود"))

    assert response.status_code == 404


def test_text_question_passes_previous_turns_to_the_assistant(
    auth_context: AuthTestContext, monkeypatch
):
    class CapturingProvider:
        def __init__(self) -> None:
            self.question = ""
            self.history = None
            self.system_prompt = ""

        async def generate_response(
            self, system_prompt: str, user_question: str, history=None
        ) -> str:
            self.system_prompt = system_prompt
            self.question = user_question
            self.history = history
            return "قیمت لاته ۱۴۵ هزار تومان است."

    provider = CapturingProvider()
    monkeypatch.setattr(assistant_service, "llm_provider", provider)

    response = auth_context.client.post(
        "/api/v1/restaurants/demo/ask-text",
        json={
            "question": "قیمتش چقدر است؟",
            "history": [
                {
                    "question": "لاته چه ترکیباتی دارد؟",
                    "answer": "لاته اسپرسو و شیر دارد.",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "قیمت لاته ۱۴۵ هزار تومان است."
    assert provider.question == "قیمتش چقدر است؟"
    assert provider.history == [("لاته چه ترکیباتی دارد؟", "لاته اسپرسو و شیر دارد.")]
    assert "تاریخچه گفتگو" in provider.system_prompt
    assert "price_toman" in provider.system_prompt
    assert '"name": "لاته"' in provider.system_prompt


class FixedAnswerProvider:
    def __init__(self, answer: str) -> None:
        self.answer = answer

    async def generate_response(
        self, system_prompt: str, user_question: str, history=None
    ) -> str:
        return self.answer


def test_text_answer_returns_recommended_menu_items(
    auth_context: AuthTestContext, monkeypatch
):
    monkeypatch.setattr(
        assistant_service,
        "llm_provider",
        FixedAnswerProvider("پیشنهاد ما لاته است؛ ۱۴۵ هزار تومان."),
    )

    response = auth_context.client.post(
        "/api/v1/restaurants/demo/ask-text",
        json={"question": "چه چیزی پیشنهاد می‌دهید؟"},
    )

    assert response.status_code == 200
    recommended = response.json()["recommended_items"]
    assert [item["id"] for item in recommended] == ["latte"]
    assert recommended[0]["name"] == "لاته"


def test_text_answer_without_item_names_has_no_recommendations(
    auth_context: AuthTestContext, monkeypatch
):
    monkeypatch.setattr(
        assistant_service,
        "llm_provider",
        FixedAnswerProvider("امروز هوا آفتابی است."),
    )

    response = auth_context.client.post(
        "/api/v1/restaurants/demo/ask-text",
        json={"question": "هوا چطور است؟"},
    )

    assert response.status_code == 200
    assert response.json()["recommended_items"] == []


def test_recommendation_matcher_handles_aliases_and_persian_variants():
    menu = RestaurantMenu(
        restaurant_slug="demo",
        restaurant_name="کافهٔ آزمایشی",
        items=[
            MenuItem(
                id="cola",
                name="نوشابه کوکا",
                category="نوشیدنی سرد",
                description="",
                aliases=["کوکا", "کوکاکولا"],
                price=Price(amount=600_000, currency="IRR"),
            ),
            MenuItem(
                id="latte",
                name="لاته",
                category="نوشیدنی گرم",
                description="",
                price=Price(amount=1_450_000, currency="IRR"),
            ),
        ],
    )

    # «ك» عربی و «کوکا»ی جایگزین باید هر دو تشخیص داده شوند.
    assert [item.id for item in find_mentioned_items(menu, "بله، نوشابه كوكا موجود است.")] == [
        "cola"
    ]
    assert [item.id for item in find_mentioned_items(menu, "کوکاکولا و لاته داریم.")] == [
        "cola",
        "latte",
    ]
    assert find_mentioned_items(menu, "شیک شکلات با بستنی") == []
    assert len(find_mentioned_items(menu, "کوکا و لاته", limit=1)) == 1


def test_duplicate_item_key_is_rejected(auth_context: AuthTestContext):
    client = auth_context.client
    assert login(client).status_code == 200
    payload = new_item_payload()
    payload["item_key"] = "latte"

    response = client.post("/api/v1/restaurants/demo/items", json=payload)

    assert response.status_code == 409
    assert "شناسه" in response.json()["detail"]
