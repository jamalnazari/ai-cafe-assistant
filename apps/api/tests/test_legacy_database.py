"""تست سازگاری با دیتابیس‌های قدیمی.

در نسخه‌های قبلی ستون `users.email` اجباری (NOT NULL) بود و ستون‌های
`username`/`role`/`restaurant_id`/`is_active` وجود نداشت. چون پنل مدیر فقط
نام کاربری و رمز می‌گیرد، ساخت کافه روی چنین دیتابیسی باید بدون خطا انجام شود.
"""

import asyncio
import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.identity import is_placeholder_email, placeholder_email
from app.db.session import Base
from app.models import RestaurantModel, UserModel  # noqa: F401 - ثبت جدول‌ها در metadata

API_DIR = Path(__file__).resolve().parents[1]


def test_identity_helpers():
    assert placeholder_email("Teras_Owner") == "teras_owner@users.cafe.local"
    assert placeholder_email(None) == "user@users.cafe.local"
    assert is_placeholder_email("owner@users.cafe.local") is True
    assert is_placeholder_email("owner@cafe.com") is False
    assert is_placeholder_email(None) is False


async def _build_legacy_database(path: Path) -> None:
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # جدول users را به ساختار قدیمی (بدون username/role و با email اجباری) برمی‌گردانیم.
        await connection.execute(
            text(
                """
                CREATE TABLE users_legacy (
                    id INTEGER NOT NULL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    is_owner BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        await connection.execute(
            text(
                """
                INSERT INTO users_legacy (id, email, password_hash, is_owner, created_at)
                SELECT id, COALESCE(email, 'owner@cafe.com'), password_hash, is_owner, created_at
                FROM users
                """
            )
        )
        await connection.execute(text("DROP TABLE users"))
        await connection.execute(text("ALTER TABLE users_legacy RENAME TO users"))
    await engine.dispose()


def test_admin_can_create_cafe_on_legacy_database(tmp_path):
    database_path = tmp_path / "legacy.db"
    asyncio.run(_build_legacy_database(database_path))

    script = textwrap.dedent(
        """
        import json
        from fastapi.testclient import TestClient
        import main

        with TestClient(main.app) as client:
            login = client.post(
                "/api/v1/auth/login",
                json={"username": "jamal", "password": "Jamal@1381"},
            )
            created = client.post(
                "/api/v1/admin/restaurants",
                json={
                    "name": "عمارت",
                    "label_word": "رستوران",
                    "slug": "emarat",
                    "owner_username": "emarat",
                    "owner_password": "Emarat@123",
                },
            )
            client.post("/api/v1/auth/logout")
            owner_login = client.post(
                "/api/v1/auth/login",
                json={"username": "emarat", "password": "Emarat@123"},
            )
            payload = {
                "login": login.status_code,
                "create": created.status_code,
                "create_detail": created.text[:400],
                "menu_path": created.json().get("menu_path") if created.status_code == 201 else None,
                "owner_login": owner_login.status_code,
                "owner_email": owner_login.json().get("email") if owner_login.status_code == 200 else None,
            }
        print("RESULT:" + json.dumps(payload, ensure_ascii=False))
        """
    )

    env = dict(os.environ)
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{database_path}"
    env["ENVIRONMENT"] = "test"
    completed = subprocess.run(
        [sys.executable, "-c", script],
        cwd=API_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert completed.returncode == 0, completed.stderr[-2000:]

    marker = [
        line for line in completed.stdout.splitlines() if line.startswith("RESULT:")
    ]
    assert marker, completed.stdout[-2000:]
    result = json.loads(marker[-1].removeprefix("RESULT:"))

    assert result["login"] == 200, result
    assert result["create"] == 201, result["create_detail"]
    assert result["menu_path"] == "/r/emarat"
    # صاحب کافه می‌تواند وارد شود و نشانی جای‌نگهدارش نمایش داده نمی‌شود.
    assert result["owner_login"] == 200, result
    assert result["owner_email"] is None, result
