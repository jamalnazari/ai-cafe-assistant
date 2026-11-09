"""تست‌های هویت کافه: نام، لوگو، پس‌زمینه و توضیحات «دربارهٔ مجموعه»."""

import asyncio
import base64

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.db.init_db import ensure_schema_columns
from app.db.session import Base, get_db
from app.models import RestaurantModel, UserModel
from app.services.branding_image_service import branding_image_service
from app.services.menu_image_service import menu_image_service
from main import app

PNG_IMAGE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.fixture
def branding_context(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'branding.db'}")
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
                        password_hash=hash_password("secret-pass"),
                        is_owner=True,
                    ),
                    RestaurantModel(slug="demo", name="کافهٔ آزمایشی"),
                ]
            )
            await session.commit()

    asyncio.run(setup_database())

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    uploads = tmp_path / "branding-uploads"
    monkeypatch.setattr(settings, "SESSION_COOKIE_SECURE", True)
    monkeypatch.setattr(branding_image_service, "upload_dir", uploads)
    monkeypatch.setattr(menu_image_service, "upload_dir", tmp_path / "menu-uploads")

    with TestClient(app, base_url="https://testserver") as client:
        yield client, uploads

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def login(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@cafe.com", "password": "secret-pass"},
    )
    assert response.status_code == 200


def menu_of(client: TestClient) -> dict:
    response = client.get("/api/v1/restaurants/demo/menu")
    assert response.status_code == 200
    return response.json()


def upload_file(client: TestClient, path: str, content_type: str, data: bytes):
    return client.post(
        path,
        files={"file": ("branding", data, content_type)},
    )


# --- نام کافه ---


def test_owner_can_rename_restaurant(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.patch(
        "/api/v1/restaurants/demo", json={"name": "کافه رستوران ونوشه"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "کافه رستوران ونوشه"
    assert menu_of(client)["restaurant_name"] == "کافه رستوران ونوشه"


def test_rename_trims_spaces_and_rejects_empty_name(branding_context):
    client, _uploads = branding_context
    login(client)

    trimmed = client.patch("/api/v1/restaurants/demo", json={"name": "  کافه ونوشه  "})
    assert trimmed.status_code == 200
    assert trimmed.json()["name"] == "کافه ونوشه"

    empty = client.patch("/api/v1/restaurants/demo", json={"name": "   "})
    assert empty.status_code == 422


def test_rename_requires_owner_session(branding_context):
    client, _uploads = branding_context

    response = client.patch("/api/v1/restaurants/demo", json={"name": "کافه جدید"})

    assert response.status_code == 401


def test_rename_unknown_restaurant_returns_persian_error(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.patch(
        "/api/v1/restaurants/unknown", json={"name": "کافه جدید"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "کافه یافت نشد."


# --- لوگو ---


def test_menu_has_no_branding_by_default(branding_context):
    client, _uploads = branding_context

    menu = menu_of(client)

    assert menu["logo_url"] is None
    assert menu["background_url"] is None


def test_owner_can_upload_logo(branding_context):
    client, uploads = branding_context
    login(client)

    response = upload_file(client, "/api/v1/restaurants/demo/logo", "image/png", PNG_IMAGE)

    assert response.status_code == 200
    logo_url = response.json()["logo_url"]
    assert logo_url.startswith("/api/v1/uploads/branding/")
    assert (uploads / logo_url.rsplit("/", 1)[-1]).exists()
    assert menu_of(client)["logo_url"] == logo_url


def test_replacing_logo_deletes_previous_file(branding_context):
    client, uploads = branding_context
    login(client)

    first = upload_file(
        client, "/api/v1/restaurants/demo/logo", "image/png", PNG_IMAGE
    ).json()["logo_url"]
    second = upload_file(
        client, "/api/v1/restaurants/demo/logo", "image/png", PNG_IMAGE
    ).json()["logo_url"]

    assert first != second
    assert not (uploads / first.rsplit("/", 1)[-1]).exists()
    assert (uploads / second.rsplit("/", 1)[-1]).exists()


def test_logo_upload_rejects_non_image(branding_context):
    client, _uploads = branding_context
    login(client)

    response = upload_file(
        client, "/api/v1/restaurants/demo/logo", "text/plain", b"not an image"
    )

    assert response.status_code == 415
    assert "JPG" in response.json()["detail"]


def test_owner_can_remove_logo(branding_context):
    client, uploads = branding_context
    login(client)

    logo_url = upload_file(
        client, "/api/v1/restaurants/demo/logo", "image/png", PNG_IMAGE
    ).json()["logo_url"]

    response = client.delete("/api/v1/restaurants/demo/logo")

    assert response.status_code == 200
    assert response.json()["logo_url"] is None
    assert menu_of(client)["logo_url"] is None
    assert not (uploads / logo_url.rsplit("/", 1)[-1]).exists()


def test_removing_missing_logo_returns_persian_error(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.delete("/api/v1/restaurants/demo/logo")

    assert response.status_code == 404
    assert response.json()["detail"] == "تصویری برای حذف ثبت نشده است."


# --- پس‌زمینه ---


def test_owner_can_upload_and_remove_background(branding_context):
    client, uploads = branding_context
    login(client)

    response = upload_file(
        client, "/api/v1/restaurants/demo/background", "image/png", PNG_IMAGE
    )

    assert response.status_code == 200
    background_url = response.json()["background_url"]
    assert background_url.startswith("/api/v1/uploads/branding/")
    assert menu_of(client)["background_url"] == background_url
    assert (uploads / background_url.rsplit("/", 1)[-1]).exists()

    removed = client.delete("/api/v1/restaurants/demo/background")

    assert removed.status_code == 200
    assert menu_of(client)["background_url"] is None


def test_branding_upload_requires_owner_session(branding_context):
    client, _uploads = branding_context

    response = upload_file(
        client, "/api/v1/restaurants/demo/background", "image/png", PNG_IMAGE
    )

    assert response.status_code == 401


def test_branding_upload_for_unknown_restaurant_returns_404(branding_context):
    client, _uploads = branding_context
    login(client)

    response = upload_file(
        client, "/api/v1/restaurants/unknown/logo", "image/png", PNG_IMAGE
    )

    assert response.status_code == 404


# --- مهاجرت خودکار دیتابیس‌های قدیمی ---


@pytest.mark.asyncio
async def test_schema_upgrade_adds_branding_columns_to_legacy_database(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "CREATE TABLE restaurants ("
                "id INTEGER PRIMARY KEY, slug VARCHAR(50), name VARCHAR(100), "
                "is_active BOOLEAN, created_at DATETIME)"
            )
        )
        await connection.execute(
            text(
                "CREATE TABLE menu_items ("
                "id INTEGER PRIMARY KEY, restaurant_id INTEGER, "
                "item_key VARCHAR(50), name VARCHAR(255), category VARCHAR(100), "
                "description TEXT, price_amount INTEGER, price_currency VARCHAR(3))"
            )
        )
        await connection.execute(
            text(
                "CREATE TABLE menu_categories ("
                "id INTEGER PRIMARY KEY, restaurant_id INTEGER, name VARCHAR(50))"
            )
        )
        await connection.execute(
            text("INSERT INTO restaurants (slug, name) VALUES ('demo', 'کافه قدیمی')")
        )

    async with engine.begin() as connection:
        await ensure_schema_columns(connection)

    async with engine.connect() as connection:
        restaurant_columns = await connection.run_sync(
            lambda sync_conn: {
                column["name"]
                for column in inspect(sync_conn).get_columns("restaurants")
            }
        )
        menu_columns = await connection.run_sync(
            lambda sync_conn: {
                column["name"]
                for column in inspect(sync_conn).get_columns("menu_items")
            }
        )
        legacy_name = await connection.scalar(
            text("SELECT name FROM restaurants WHERE slug = 'demo'")
        )

    assert {"logo_filename", "background_filename", "about_text"} <= restaurant_columns
    assert {"image_filename", "aliases", "sort_order"} <= menu_columns
    assert legacy_name == "کافه قدیمی"

    await engine.dispose()


# --- دربارهٔ مجموعه (about) ---

ABOUT_SAMPLE = (
    "کافه‌ای دنج با فضای باز و تراس، مناسب کار و مطالعه.\n"
    "پارکینگ رایگان، اینترنت پرسرعت و منوی گیاهی داریم.\n"
    "ساعت کاری: هر روز ۹ صبح تا ۲۳ شب."
)


def test_owner_can_save_about_text(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.patch(
        "/api/v1/restaurants/demo", json={"about": ABOUT_SAMPLE}
    )

    assert response.status_code == 200
    assert response.json()["about"] == ABOUT_SAMPLE
    # نام کافه نباید با ذخیرهٔ توضیحات تغییر کند.
    assert menu_of(client)["restaurant_name"] == "کافهٔ آزمایشی"
    assert menu_of(client)["restaurant_about"] == ABOUT_SAMPLE


def test_about_is_cleaned_and_can_be_cleared(branding_context):
    client, _uploads = branding_context
    login(client)

    messy = client.patch(
        "/api/v1/restaurants/demo",
        json={"about": "  خط اول  \n\n   \n خط دوم "},
    )
    assert messy.status_code == 200
    assert messy.json()["about"] == "خط اول\nخط دوم"

    cleared = client.patch("/api/v1/restaurants/demo", json={"about": "   "})
    assert cleared.status_code == 200
    assert cleared.json()["about"] is None
    assert menu_of(client)["restaurant_about"] is None


def test_about_rejects_too_long_text(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.patch(
        "/api/v1/restaurants/demo", json={"about": "ا" * 1501}
    )

    assert response.status_code == 422


def test_about_requires_owner_session(branding_context):
    client, _uploads = branding_context

    response = client.patch("/api/v1/restaurants/demo", json={"about": ABOUT_SAMPLE})

    assert response.status_code == 401


def test_empty_update_body_is_rejected(branding_context):
    client, _uploads = branding_context
    login(client)

    response = client.patch("/api/v1/restaurants/demo", json={})

    assert response.status_code == 422


def test_about_text_is_injected_into_assistant_prompt():
    from app.schemas.menu import MenuItem, Price, RestaurantMenu
    from app.services.assistant_service import AssistantService

    menu = RestaurantMenu(
        restaurant_slug="demo",
        restaurant_name="کافهٔ آزمایشی",
        restaurant_about=ABOUT_SAMPLE,
        items=[
            MenuItem(
                id="latte",
                name="لاته",
                category="نوشیدنی گرم",
                description="",
                price=Price(amount=1_450_000, currency="IRR"),
            )
        ],
    )

    # بدون ساخت providerها؛ فقط منطق ساخت پرامپت بررسی می‌شود.
    service = object.__new__(AssistantService)
    prompt = service._build_system_prompt(menu)

    assert "پارکینگ رایگان" in prompt
    assert "۹." in prompt
    assert '"about"' in prompt


def test_about_null_in_prompt_when_not_registered():
    from app.schemas.menu import MenuItem, Price, RestaurantMenu
    from app.services.assistant_service import AssistantService

    menu = RestaurantMenu(
        restaurant_slug="demo",
        restaurant_name="کافهٔ آزمایشی",
        items=[
            MenuItem(
                id="latte",
                name="لاته",
                category="نوشیدنی گرم",
                description="",
                price=Price(amount=1_450_000, currency="IRR"),
            )
        ],
    )

    service = object.__new__(AssistantService)
    payload = service._menu_payload(menu)
    prompt = service._build_system_prompt(menu)

    assert payload["restaurant"]["about"] is None
    assert '"about": null' in prompt


def test_prompt_describes_menu_when_about_is_empty():
    """با خالی بودن «دربارهٔ مجموعه» دستیار نباید پرسش عمومی را کاملاً رد کند."""
    from app.schemas.menu import MenuItem, Price, RestaurantMenu
    from app.services.assistant_service import AssistantService

    menu = RestaurantMenu(
        restaurant_slug="demo",
        restaurant_name="کافهٔ آزمایشی",
        items=[
            MenuItem(
                id="latte",
                name="لاته",
                category="نوشیدنی گرم",
                description="",
                price=Price(amount=1_450_000, currency="IRR"),
            )
        ],
    )

    service = object.__new__(AssistantService)
    prompt = service._build_system_prompt(menu)

    assert "۱۰." in prompt
    assert "معرفی کوتاه" in prompt
    assert "ساعت کاری یا " in prompt
