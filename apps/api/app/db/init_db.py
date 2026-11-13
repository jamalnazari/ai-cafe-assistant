import asyncio
from sqlalchemy import func, inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import engine, Base, AsyncSessionLocal
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.user import UserModel
from app.models.auth_session import AuthSessionModel  # noqa: F401 - ثبت مدل در metadata
from app.core.config import DEFAULT_ADMIN_USERNAME, settings
from app.core.security import hash_password
from app.services.branding_image_service import (
    SAMPLE_BACKGROUND_FILE,
    SAMPLE_LOGO_FILE,
    branding_image_service,
)


async def backfill_menu_categories(session: AsyncSession) -> None:
    """ساخت دسته‌های موجود در دیتابیس‌های قدیمی بدون تکرار."""
    item_categories = (
        await session.execute(
            select(MenuItemModel.restaurant_id, MenuItemModel.category).distinct()
        )
    ).all()
    existing_categories = set(
        (
            await session.execute(
                select(MenuCategoryModel.restaurant_id, MenuCategoryModel.name)
            )
        ).all()
    )

    for restaurant_id, item_category in item_categories:
        category_name = item_category.strip()
        category_key = (restaurant_id, category_name)
        if category_name and category_key not in existing_categories:
            session.add(
                MenuCategoryModel(restaurant_id=restaurant_id, name=category_name)
            )
            existing_categories.add(category_key)


async def apply_sample_branding(session: AsyncSession) -> None:
    """اگر کافه هنوز لوگو/پس‌زمینه ندارد، تصاویر نمونهٔ پروژه را نصب می‌کند."""
    restaurant = (
        await session.execute(
            select(RestaurantModel).where(RestaurantModel.slug == "demo")
        )
    ).scalar_one_or_none()
    if restaurant is None:
        return

    changed = False
    if not restaurant.logo_filename:
        sample_logo = branding_image_service.install_sample(SAMPLE_LOGO_FILE)
        if sample_logo:
            restaurant.logo_filename = sample_logo
            changed = True
    if not restaurant.background_filename:
        sample_background = branding_image_service.install_sample(
            SAMPLE_BACKGROUND_FILE
        )
        if sample_background:
            restaurant.background_filename = sample_background
            changed = True

    if changed:
        print("تصاویر نمونهٔ هویت کافه (لوگو و پس‌زمینه) نصب شد.")


async def backfill_usernames(conn) -> None:
    """برای کاربران قدیمی (که فقط ایمیل داشتند) نام کاربری می‌سازد.

    نام کاربری از بخش قبل از @ ایمیل گرفته می‌شود و در صورت تکراری بودن،
    شمارهٔ شناسه به آن اضافه می‌شود تا ایندکس یکتا قابل ساخت باشد.
    """
    rows = (
        await conn.execute(
            text("SELECT id, email, username FROM users ORDER BY id")
        )
    ).all()

    taken = {str(row[2]).lower() for row in rows if row[2]}
    for user_id, email, username in rows:
        if username:
            continue
        base = ""
        if email and "@" in str(email):
            base = str(email).split("@", 1)[0]
        base = "".join(
            char for char in base.lower() if char.isalnum() or char in {"_", "-", "."}
        ) or f"user_{user_id}"
        candidate = base
        suffix = 1
        while candidate in taken:
            suffix += 1
            candidate = f"{base}{suffix}"
        taken.add(candidate)
        await conn.execute(
            text("UPDATE users SET username = :username WHERE id = :user_id"),
            {"username": candidate, "user_id": user_id},
        )

    # اگر نام کاربری تکراری باقی مانده باشد، ایندکس ساخته نمی‌شود.
    duplicates = (
        await conn.execute(
            text(
                "SELECT username FROM users WHERE username IS NOT NULL "
                "GROUP BY lower(username) HAVING COUNT(*) > 1 LIMIT 1"
            )
        )
    ).first()
    if duplicates is None:
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_unique "
                "ON users (username)"
            )
        )


async def ensure_schema_columns(conn) -> None:
    """
    ستون‌های اضافه‌شده در نسخه‌های جدید را بدون حذف داده به جدول‌ها اضافه می‌کند.
    هم init_db و هم راه‌اندازی سرویس از این تابع استفاده می‌کنند تا دیتابیس‌های
    قدیمی (از جمله دیتابیس لپ‌تاپ کاربر) به‌صورت خودکار به‌روز شوند.
    """

    def table_columns(sync_conn, table_name: str) -> set[str] | None:
        inspector = inspect(sync_conn)
        if not inspector.has_table(table_name):
            return None
        return {column["name"] for column in inspector.get_columns(table_name)}

    menu_item_columns = await conn.run_sync(table_columns, "menu_items")
    if menu_item_columns is not None:
        # دیتابیس‌های قبلی بدون حذف داده به‌روزرسانی می‌شوند.
        if "image_filename" not in menu_item_columns:
            await conn.execute(
                text("ALTER TABLE menu_items ADD COLUMN image_filename VARCHAR(255)")
            )
        if "aliases" not in menu_item_columns:
            await conn.execute(
                text("ALTER TABLE menu_items ADD COLUMN aliases JSON")
            )
        if "sort_order" not in menu_item_columns:
            await conn.execute(
                text(
                    "ALTER TABLE menu_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
                )
            )

    category_columns = await conn.run_sync(table_columns, "menu_categories")
    if category_columns is not None and "sort_order" not in category_columns:
        await conn.execute(
            text(
                "ALTER TABLE menu_categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
        )

    restaurant_columns = await conn.run_sync(table_columns, "restaurants")
    if restaurant_columns is not None:
        # هویت بصری کافه (لوگو و تصویر پس‌زمینه)
        if "logo_filename" not in restaurant_columns:
            await conn.execute(
                text("ALTER TABLE restaurants ADD COLUMN logo_filename VARCHAR(255)")
            )
        if "background_filename" not in restaurant_columns:
            await conn.execute(
                text(
                    "ALTER TABLE restaurants ADD COLUMN background_filename VARCHAR(255)"
                )
            )
        # توضیحات «دربارهٔ مجموعه» برای پاسخ‌های دستیار هوشمند
        if "about_text" not in restaurant_columns:
            await conn.execute(
                text("ALTER TABLE restaurants ADD COLUMN about_text TEXT")
            )
        # واژهٔ نمایشی قبل از نام کافه/رستوران
        if "label_word" not in restaurant_columns:
            await conn.execute(
                text(
                    "ALTER TABLE restaurants ADD COLUMN label_word VARCHAR(30) "
                    "NOT NULL DEFAULT 'کافه'"
                )
            )

    # --- کاربران: نام کاربری، نقش، اتصال به کافه و فعال/غیرفعال ---
    user_columns = await conn.run_sync(table_columns, "users")
    if user_columns is not None:
        if "username" not in user_columns:
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN username VARCHAR(50)")
            )
        if "role" not in user_columns:
            await conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(20) "
                    "NOT NULL DEFAULT 'owner'"
                )
            )
        if "is_active" not in user_columns:
            await conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN is_active BOOLEAN "
                    "NOT NULL DEFAULT 1"
                )
            )
        if "restaurant_id" not in user_columns:
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN restaurant_id INTEGER")
            )

        await backfill_usernames(conn)

    if menu_item_columns is None:
        return

    # کلید آیتم باید در هر رستوران یکتا باشد تا LLM و API دچار ابهام نشوند.
    duplicate_keys = (
        await conn.execute(
            text(
                "SELECT restaurant_id, item_key, COUNT(*) AS duplicate_count "
                "FROM menu_items GROUP BY restaurant_id, item_key "
                "HAVING duplicate_count > 1 LIMIT 1"
            )
        )
    ).first()
    if duplicate_keys is None:
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "ux_menu_items_restaurant_item_key "
                "ON menu_items (restaurant_id, item_key)"
            )
        )
    else:
        print(
            "هشدار: کلید آیتم تکراری پیدا شد و ایندکس یکتا ساخته نشد: "
            f"{duplicate_keys}"
        )


async def ensure_admin_user(session: AsyncSession) -> None:
    """در اولین اجرا حساب مدیر کل را می‌سازد تا پنل مدیریت در دسترس باشد."""
    username = (settings.ADMIN_USERNAME or DEFAULT_ADMIN_USERNAME).strip().lower()

    existing_admin = (
        await session.execute(
            select(UserModel).where(UserModel.role == "admin").limit(1)
        )
    ).scalar_one_or_none()
    if existing_admin is not None:
        return

    same_username = (
        await session.execute(
            select(UserModel).where(func.lower(UserModel.username) == username)
        )
    ).scalar_one_or_none()

    if same_username is not None:
        same_username.role = "admin"
        same_username.is_active = True
    else:
        session.add(
            UserModel(
                username=username,
                # در دیتابیس‌های قدیمی ستون email اجباری است؛ این نشانی
                # فقط جای‌نگهدار است و به کاربر نمایش داده نمی‌شود.
                email=f"{username}@admin.cafe.local",
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_owner=True,
                is_active=True,
            )
        )
        print(
            "حساب مدیر کل ساخته شد "
            f"(نام کاربری: {username} | رمز پیش‌فرض در .env قابل تغییر است)"
        )


async def link_orphan_owners(session: AsyncSession) -> None:
    """کاربران صاحب کافه‌ای که به کافه‌ای وصل نیستند را به کافهٔ پیش‌فرض وصل می‌کند."""
    first_restaurant = (
        await session.execute(select(RestaurantModel).order_by(RestaurantModel.id))
    ).scalars().first()
    if first_restaurant is None:
        return

    orphans = (
        await session.execute(
            select(UserModel).where(
                UserModel.role == "owner",
                UserModel.restaurant_id.is_(None),
            )
        )
    ).scalars().all()
    for owner in orphans:
        owner.restaurant_id = first_restaurant.id


async def init_db():
    print("در حال به‌روزرسانی جدول‌ها در SQLite...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_schema_columns(conn)
    async with AsyncSessionLocal() as session:
        # ساخت کاربر اولیه صاحب کافه
        user_result = await session.execute(
            select(UserModel).where(UserModel.email == "owner@cafe.com")
        )
        if not user_result.scalar_one_or_none():
            owner_user = UserModel(
                username="owner",
                email="owner@cafe.com",
                password_hash=hash_password("123456"),
                role="owner",
                is_owner=True,
                is_active=True,
            )
            session.add(owner_user)
            print(
                "کاربر صاحب کافه ساخته شد "
                "(نام کاربری: owner | ایمیل: owner@cafe.com | رمز: 123456)"
            )

        # ساخت کافه اولیه
        restaurant_result = await session.execute(
            select(RestaurantModel).where(RestaurantModel.slug == "demo")
        )
        if not restaurant_result.scalar_one_or_none():
            demo_restaurant = RestaurantModel(
                slug="demo",
                name="کافهٔ آزمایشی",
                categories=[
                    MenuCategoryModel(name="نوشیدنی گرم"),
                    MenuCategoryModel(name="نوشیدنی سرد"),
                    MenuCategoryModel(name="غذای گرم"),
                    MenuCategoryModel(name="دسر"),
                ],
                items=[
                    MenuItemModel(
                        item_key="latte",
                        name="لاته",
                        category="نوشیدنی گرم",
                        description="اسپرسو همراه با شیر بخار داده‌شده.",
                        ingredients=["اسپرسو", "شیر"],
                        allergens=["شیر"],
                        is_spicy=False,
                        serving_temperature="hot",
                        price_amount=1_450_000,
                        price_currency="IRR",
                    ),
                    MenuItemModel(
                        item_key="lemonade",
                        name="لیموناد",
                        category="نوشیدنی سرد",
                        description="نوشیدنی خنک با آب‌لیمو و شکر.",
                        ingredients=["آب‌لیمو", "آب", "شکر"],
                        allergens=None,
                        is_spicy=False,
                        serving_temperature="cold",
                        price_amount=950_000,
                        price_currency="IRR",
                    ),
                    MenuItemModel(
                        item_key="spicy-chicken-sandwich",
                        name="ساندویچ مرغ تند",
                        category="غذای گرم",
                        description="ساندویچ مرغ با سس تند.",
                        ingredients=["نان", "مرغ", "سس تند", "کاهو"],
                        allergens=["گلوتن"],
                        is_spicy=True,
                        serving_temperature="hot",
                        price_amount=2_800_000,
                        price_currency="IRR",
                    ),
                ],
            )
            session.add(demo_restaurant)
            print("داده‌های اولیه کافه اضافه شد.")

        await session.flush()
        await backfill_menu_categories(session)
        await apply_sample_branding(session)
        await ensure_admin_user(session)
        await link_orphan_owners(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(init_db())