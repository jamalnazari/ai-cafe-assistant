import asyncio
from app.db.session import engine, Base, AsyncSessionLocal
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel


async def init_db():
    print("در حال ساخت جدول‌های دیتابیس در SQLite...")
    async with engine.begin() as conn:
        # ساخت جدول‌ها
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # بررسی اینکه آیا کافه اولیه وجود دارد یا نه
        from sqlalchemy import select

        result = await session.execute(
            select(RestaurantModel).where(RestaurantModel.slug == "demo")
        )
        existing_restaurant = result.scalar_one_or_none()

        if not existing_restaurant:
            print("در حال اضافه کردن داده‌های اولیهٔ کافه...")
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
            await session.commit()
            print("داده‌های اولیه با موفقیت ذخیره شدند.")
        else:
            print("داده‌های اولیه قبلاً موجود بودند.")


if __name__ == "__main__":
    asyncio.run(init_db())