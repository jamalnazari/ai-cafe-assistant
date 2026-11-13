"""تست‌های پنل مدیر سامانه: چند کافه، کاربران، QR و برچسب نمایشی."""

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password
from app.db.session import Base, get_db
from app.models import RestaurantModel, UserModel
from app.services.menu_image_service import menu_image_service
from app.services.branding_image_service import branding_image_service
from main import app

ADMIN_USERNAME = "jamal"
ADMIN_PASSWORD = "Jamal@1381"


@pytest.fixture
def admin_context(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'admin.db'}")
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
    monkeypatch.setattr(branding_image_service, "upload_dir", tmp_path / "uploads")
    monkeypatch.setattr(
        menu_image_service, "upload_dir", tmp_path / "menu-uploads"
    )

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def login(client: TestClient, username: str, password: str):
    return client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )


def create_cafe(client: TestClient, **overrides):
    payload = {
        "name": "تراس",
        "label_word": "کافه",
        "owner_username": "teras_owner",
        "owner_password": "Teras@1234",
    }
    payload.update(overrides)
    return client.post("/api/v1/admin/restaurants", json=payload)


def test_admin_can_login_with_username(admin_context):
    client = admin_context
    response = login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    me = client.get("/api/v1/auth/me").json()
    assert me["role"] == "admin"
    assert me["restaurant_slug"] is None


def test_only_admin_reaches_the_admin_panel(admin_context):
    client = admin_context
    assert client.get("/api/v1/admin/restaurants").status_code == 401

    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    assert create_cafe(client).status_code == 201
    client.post("/api/v1/auth/logout")

    owner_login = login(client, "teras_owner", "Teras@1234")
    assert owner_login.status_code == 200
    assert client.get("/api/v1/admin/restaurants").status_code == 403


def test_admin_creates_cafe_and_owner_can_manage_it(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    created = create_cafe(client, name="کافه رستوران ونوشه", label_word="کافه رستوران")
    assert created.status_code == 201
    cafe = created.json()
    assert cafe["slug"]  # نشانی خودکار ساخته شده است
    assert cafe["owner_username"] == "teras_owner"
    assert cafe["menu_path"] == f"/r/{cafe['slug']}"
    assert cafe["is_active"] is True

    # فهرست مدیر
    listed = client.get("/api/v1/admin/restaurants").json()
    assert [item["id"] for item in listed] == [cafe["id"]]

    # صاحب کافه وارد می‌شود و کافهٔ خودش را می‌بیند
    client.post("/api/v1/auth/logout")
    assert login(client, "teras_owner", "Teras@1234").status_code == 200
    me = client.get("/api/v1/auth/me").json()
    assert me["role"] == "owner"
    assert me["restaurant_slug"] == cafe["slug"]
    assert me["restaurant_label"] == "کافه رستوران"

    # و می‌تواند منوی همان کافه را ویرایش کند
    rename = client.patch(
        f"/api/v1/restaurants/{cafe['slug']}", json={"name": "ونوشه"}
    )
    assert rename.status_code == 200


def test_owner_cannot_manage_another_cafe(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    first = create_cafe(client, name="کافه یک", owner_username="owner_one").json()
    second = create_cafe(
        client,
        name="کافه دو",
        owner_username="owner_two",
        owner_password="Owner@1234",
    ).json()

    client.post("/api/v1/auth/logout")
    assert login(client, "owner_one", "Teras@1234").status_code == 200

    # کافهٔ خودش مجاز است
    assert (
        client.patch(
            f"/api/v1/restaurants/{first['slug']}", json={"name": "تغییر"}
        ).status_code
        == 200
    )
    # کافهٔ دیگری نه
    forbidden = client.patch(
        f"/api/v1/restaurants/{second['slug']}", json={"name": "دستکاری"}
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "شما به این کافه دسترسی ندارید."


def test_deleting_a_cafe_invalidates_qr_and_login(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    cafe = create_cafe(client).json()

    # QR کار می‌کند
    assert client.get(f"/api/v1/restaurants/{cafe['slug']}/menu").status_code == 200

    deleted = client.delete(f"/api/v1/admin/restaurants/{cafe['id']}")
    assert deleted.status_code == 200
    assert "QR" in deleted.json()["message"]

    # QR بعد از حذف نامعتبر است
    assert client.get(f"/api/v1/restaurants/{cafe['slug']}/menu").status_code == 404

    # ورود کاربر هم بسته شده است
    client.post("/api/v1/auth/logout")
    assert login(client, "teras_owner", "Teras@1234").status_code == 401


def test_admin_can_restore_a_deleted_cafe(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    cafe = create_cafe(client).json()
    client.delete(f"/api/v1/admin/restaurants/{cafe['id']}")

    restored = client.post(f"/api/v1/admin/restaurants/{cafe['id']}/restore")

    assert restored.status_code == 200
    assert restored.json()["is_active"] is True
    assert client.get(f"/api/v1/restaurants/{cafe['slug']}/menu").status_code == 200


def test_admin_can_rename_owner_and_reset_password(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    cafe = create_cafe(client).json()

    updated = client.patch(
        f"/api/v1/admin/restaurants/{cafe['id']}",
        json={"owner_username": "new_owner", "owner_password": "NewPass@123"},
    )
    assert updated.status_code == 200
    assert updated.json()["owner_username"] == "new_owner"

    client.post("/api/v1/auth/logout")
    assert login(client, "teras_owner", "Teras@1234").status_code == 401
    assert login(client, "new_owner", "NewPass@123").status_code == 200


def test_duplicate_username_and_reserved_slug_are_rejected(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    assert create_cafe(client).status_code == 201
    duplicate = create_cafe(client, name="کافه دیگر")
    assert duplicate.status_code == 409
    assert "نام کاربری" in duplicate.json()["detail"]

    reserved = create_cafe(
        client, name="کافه سوم", slug="admin", owner_username="owner_three"
    )
    assert reserved.status_code == 422


def test_long_slug_collision_gets_unique_suffix_within_limit(admin_context):
    """رگرسیون حلقهٔ بی‌پایان: اسلگ تکراریِ ۴۰ نویسه‌ای نباید درخواست را معلق کند.

    پیاده‌سازی قدیمی پسوند -2 و -3 را با برش [:40] حذف می‌کرد؛ نامزد تکراری
    همیشه رد می‌شد و سرور در حلقه گیر می‌کرد.
    """
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    long_slug = "a" * 40
    first = create_cafe(
        client, name="کافه طولانی", slug=long_slug, owner_username="owner_long"
    )
    assert first.status_code == 201
    assert first.json()["slug"] == long_slug

    second = create_cafe(
        client,
        name="کافه طولانی دیگر",
        slug=long_slug,
        owner_username="owner_long_two",
        owner_password="Owner@1234",
    )

    assert second.status_code == 201
    assert second.json()["slug"] != long_slug
    # پسوند داخل سقف ۴۰ نویسه جا شده است.
    assert second.json()["slug"] == "a" * 38 + "-1"


def test_label_word_is_served_to_customers(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)
    cafe = create_cafe(client, name="تراس", label_word="رستوران").json()

    menu = client.get(f"/api/v1/restaurants/{cafe['slug']}/menu").json()

    assert menu["restaurant_label"] == "رستوران"
    assert menu["restaurant_name"] == "تراس"


def test_cafe_text_is_sanitized_against_stored_xss(admin_context):
    client = admin_context
    login(client, ADMIN_USERNAME, ADMIN_PASSWORD)

    created = create_cafe(
        client,
        name='<script>alert("x")</script>کافه',
        label_word="<b>کافه</b>",
    )
    assert created.status_code == 201
    cafe = created.json()

    assert "<" not in cafe["name"] and ">" not in cafe["name"]
    assert "script" not in cafe["name"]
    assert cafe["label_word"] == "کافه"


def test_security_headers_are_present(admin_context):
    response = admin_context.get("/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_legacy_database_with_required_email_can_create_cafe(tmp_path, monkeypatch):
    """رگرسیون خطای ۵۰۰ «اضافه کردن کافه» روی دیتابیس واقعی کاربر.

    دیتابیس‌های نسخه‌های اول ستون users.email را NOT NULL ساخته بودند؛ ساخت
    صاحب کافهٔ بدون ایمیل با «NOT NULL constraint failed» به پیام «خطای
    غیرمنتظره» می‌رسید. مهاجرت خودکار باید جدول را بازسازی کند و بعد از آن
    ساخت کافه موفق شود.
    """
    import asyncio

    from sqlalchemy import inspect as sql_inspect, text
    from sqlalchemy.ext.asyncio import (
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )

    from app.db.init_db import ensure_schema_columns
    from app.db.session import Base, get_db
    from app.models import UserModel

    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def build_legacy_database() -> None:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE TABLE restaurants ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "slug VARCHAR(50) UNIQUE, name VARCHAR(100), "
                    "is_active BOOLEAN, created_at DATETIME)"
                )
            )
            await conn.execute(
                text(
                    "CREATE TABLE users ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "email VARCHAR(255) NOT NULL UNIQUE, "
                    "password_hash VARCHAR(255) NOT NULL, "
                    "is_owner BOOLEAN, created_at DATETIME)"
                )
            )
            await conn.execute(
                text(
                    "CREATE TABLE menu_items ("
                    "id INTEGER PRIMARY KEY, restaurant_id INTEGER, "
                    "item_key VARCHAR(50), name VARCHAR(255), "
                    "category VARCHAR(100), description TEXT, "
                    "price_amount INTEGER, price_currency VARCHAR(3))"
                )
            )
            await conn.execute(
                text(
                    "CREATE TABLE menu_categories ("
                    "id INTEGER PRIMARY KEY, restaurant_id INTEGER, "
                    "name VARCHAR(50))"
                )
            )
            await conn.execute(
                text(
                    "CREATE TABLE auth_sessions ("
                    "id INTEGER PRIMARY KEY, "
                    "user_id INTEGER REFERENCES users (id) ON DELETE CASCADE, "
                    "token_hash VARCHAR(64), expires_at DATETIME, "
                    "revoked_at DATETIME, created_at DATETIME)"
                )
            )
            await conn.execute(
                text(
                    "INSERT INTO restaurants (slug, name, is_active) "
                    "VALUES ('demo', 'کافه قدیمی', 1)"
                )
            )
            await conn.execute(
                text(
                    "INSERT INTO users (email, password_hash, is_owner) "
                    "VALUES ('old@cafe.com', 'legacy-hash', 1)"
                )
            )

    async def migrate() -> None:
        async with engine.begin() as conn:
            await ensure_schema_columns(conn)

    asyncio.run(build_legacy_database())
    asyncio.run(migrate())

    async def inspect_users() -> tuple[dict, list]:
        async with engine.connect() as conn:
            columns = await conn.run_sync(
                lambda sync_conn: {
                    column["name"]: column["nullable"]
                    for column in sql_inspect(sync_conn).get_columns("users")
                }
            )
            rows = (
                await conn.execute(text("SELECT id, email, username FROM users"))
            ).all()
        return columns, rows

    columns, rows = asyncio.run(inspect_users())
    # email دیگر اجباری نیست و داده‌های قدیمی با نام کاربری خودکار حفظ شده‌اند.
    assert columns["email"] is True
    assert rows == [(1, "old@cafe.com", "old")]

    async def add_admin() -> None:
        async with session_factory() as session:
            session.add(
                UserModel(
                    username="jamal",
                    email="jamal@example.com",
                    password_hash=hash_password("Legacy@1234"),
                    role="admin",
                    is_owner=True,
                    is_active=True,
                )
            )
            await session.commit()

    asyncio.run(add_admin())

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(branding_image_service, "upload_dir", tmp_path / "branding")
    monkeypatch.setattr(menu_image_service, "upload_dir", tmp_path / "menu-items")

    try:
        with TestClient(app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"username": "jamal", "password": "Legacy@1234"},
            )
            assert login.status_code == 200

            created = client.post(
                "/api/v1/admin/restaurants",
                json={
                    "name": "کافه تازه",
                    "label_word": "کافه",
                    "owner_username": "new_owner",
                    "owner_password": "NewOwner@123",
                },
            )

            assert created.status_code == 201
            assert created.json()["owner_username"] == "new_owner"
            # صاحب کافهٔ تازه بدون ایمیل ساخته شده است.
            assert (
                client.post(
                    "/api/v1/auth/login",
                    json={"username": "new_owner", "password": "NewOwner@123"},
                ).status_code
                == 200
            )
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())
