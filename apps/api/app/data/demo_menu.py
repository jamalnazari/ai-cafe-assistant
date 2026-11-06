from app.schemas.menu import MenuItem, Price, RestaurantMenu


# دادهٔ نمونه است، نه منوی واقعی ذخیره‌شده در دیتابیس.
# قیمت‌ها به ریال هستند؛ مثلاً 1,450,000 ریال برابر با 145,000 تومان است.
DEMO_MENU = RestaurantMenu(
    restaurant_slug="demo",
    restaurant_name="کافهٔ آزمایشی",
    items=[
        MenuItem(
            id="latte",
            name="لاته",
            category="نوشیدنی گرم",
            description="اسپرسو همراه با شیر بخار داده‌شده.",
            ingredients=["اسپرسو", "شیر"],
            allergens=["شیر"],
            is_spicy=False,
            serving_temperature="hot",
            price=Price(amount=1_450_000, currency="IRR"),
        ),
        MenuItem(
            id="lemonade",
            name="لیموناد",
            category="نوشیدنی سرد",
            description="نوشیدنی خنک با آب‌لیمو و شکر.",
            ingredients=["آب‌لیمو", "آب", "شکر"],
            allergens=None,
            is_spicy=False,
            serving_temperature="cold",
            price=Price(amount=950_000, currency="IRR"),
        ),
        MenuItem(
            id="spicy-chicken-sandwich",
            name="ساندویچ مرغ تند",
            category="غذای گرم",
            description="ساندویچ مرغ با سس تند.",
            ingredients=["نان", "مرغ", "سس تند", "کاهو"],
            allergens=["گلوتن"],
            is_spicy=True,
            serving_temperature="hot",
            price=Price(amount=2_800_000, currency="IRR"),
        ),
    ],
)