import asyncio
from sqlalchemy import select
from app.db.session import engine, Base, AsyncSessionLocal
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.user import UserModel
from app.models.auth_session import AuthSessionModel  # noqa: F401 - ثبت مدل در metadata
from app.core.security import hash_password


async def init_db():
    print("در حال به‌روزرسانی جدول‌ها در SQLite...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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

        await session.commit()


if __name__ == "__main__":
    asyncio.run(init_db())