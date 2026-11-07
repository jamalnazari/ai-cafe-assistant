import asyncio
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import engine, Base, AsyncSessionLocal
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.user import UserModel
from app.models.auth_session import AuthSessionModel  # noqa: F401 - ثبت مدل در metadata
from app.core.security import hash_password


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


async def init_db():
    print("در حال به‌روزرسانی جدول‌ها در SQLite...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        menu_item_columns = await conn.run_sync(
            lambda sync_conn: {
                column["name"]
                for column in inspect(sync_conn).get_columns("menu_items")
            }
        )
        # دیتابیس‌های قبلی بدون حذف داده به‌روزرسانی می‌شوند.
        if "image_filename" not in menu_item_columns:
            await conn.execute(
                text("ALTER TABLE menu_items ADD COLUMN image_filename VARCHAR(255)")
            )

    async with AsyncSessionLocal() as session:
        # ساخت کاربر اولیه صاحب کافه
        user_result = await session.execute(
            select(UserModel).where(UserModel.email == "owner@cafe.com")
        )
        if not user_result.scalar_one_or_none():
            owner_user = UserModel(
                email="owner@cafe.com",
                password_hash=hash_password("123456"),
                is_owner=True,
            )
            session.add(owner_user)
            print("کاربر صاحب کافه ساخته شد (ایمیل: owner@cafe.com | رمز: 123456)")

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
        await session.commit()


if __name__ == "__main__":
    asyncio.run(init_db())