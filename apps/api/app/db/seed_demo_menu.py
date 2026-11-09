"""استانداردسازی و تکمیل منوی نمونهٔ کافه.

این اسکریپت idempotent است و می‌توان آن را چند بار اجرا کرد:
    python -m app.db.seed_demo_menu

کارهایی که انجام می‌دهد:
- ستون‌های جدید (aliases و sort_order) را با init_db ایجاد می‌کند.
- تصاویر آماده را از app/data/menu_images به پوشهٔ uploads کپی می‌کند.
- کلید آیتم‌های قدیمی و غیراستاندارد را به slug انگلیسی تبدیل می‌کند.
- دسته‌بندی‌ها را با ترتیب مشخص می‌سازد و آیتم‌ها را با اطلاعات کامل
  (قیمت، ترکیبات، آلرژن، تندی، دما و نام‌های جایگزین) به‌روزرسانی می‌کند.
- دسته‌بندی‌های خالی و بی‌استفاده را حذف می‌کند.
"""

from __future__ import annotations

import asyncio
import shutil
from collections import defaultdict
from pathlib import Path

from sqlalchemy import func, select

from app.core.config import settings
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.restaurant import RestaurantModel
from app.services.menu_recommendation import normalize_menu_text

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "menu_images"

CATEGORIES: list[tuple[str, int]] = [
    ("غذای ایرانی", 10),
    ("فست‌فود", 20),
    ("نوشیدنی سرد", 30),
    ("نوشیدنی گرم", 40),
    ("دسر", 50),
]

ITEMS: list[dict] = [
    {
        "key": "chelow-kabab-koobideh",
        "name": "چلوکباب کوبیده",
        "category": "غذای ایرانی",
        "price_toman": 350_000,
        "description": "دو سیخ کباب کوبیدهٔ گوشت گوسفند با برنج ایرانی، گوجهٔ کبابی و کره.",
        "ingredients": ["گوشت گوسفند", "برنج", "گوجه", "کره"],
        "allergens": ["شیر"],
        "aliases": ["کباب کوبیده", "چلوکباب", "کوبیده"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "joojeh-kabab",
        "name": "چلو جوجه کباب",
        "category": "غذای ایرانی",
        "price_toman": 320_000,
        "description": "سیخ جوجه‌کباب زعفرانی با برنج ایرانی، گوجهٔ کبابی و کره.",
        "ingredients": ["مرغ", "زعفران", "برنج", "گوجه", "کره"],
        "allergens": ["شیر"],
        "aliases": ["جوجه کباب", "جوجه‌کباب", "چلو جوجه"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "ghormeh-sabzi",
        "name": "خورشت سبزی",
        "category": "غذای ایرانی",
        "price_toman": 280_000,
        "description": "خورشت سبزی با گوشت گوسفند، لوبیا قرمز، لیمو عمانی و برنج.",
        "ingredients": ["گوشت گوسفند", "سبزی خورشتی", "لوبیا قرمز", "لیمو عمانی", "برنج"],
        "allergens": [],
        "aliases": ["قیمه سبزی", "قورمه سبزی", "خورشت قیمه"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "zereshk-polo-morgh",
        "name": "زرشک‌پلو با مرغ",
        "category": "غذای ایرانی",
        "price_toman": 300_000,
        "description": "ران مرغ زعفرانی با برنج، زرشک و خلال پسته.",
        "ingredients": ["مرغ", "برنج", "زرشک", "پسته"],
        "allergens": ["پسته"],
        "aliases": ["زرشک پلو", "زرشک‌پلو", "مرغ زرشک پلو"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "ash-reshteh",
        "name": "آش رشته",
        "category": "غذای ایرانی",
        "price_toman": 180_000,
        "description": "آش سنتی با رشته، حبوبات، سبزی و کشک.",
        "ingredients": ["رشته", "لوبیا", "نخود", "سبزی", "کشک"],
        "allergens": ["گلوتن", "شیر"],
        "aliases": ["آش", "آش سنتی"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "mirza-ghasemi",
        "name": "میرزاقاسمی",
        "category": "غذای ایرانی",
        "price_toman": 190_000,
        "description": "بادمجان کبابی با گوجه، سیر، تخم‌مرغ و روغن زیتون.",
        "ingredients": ["بادمجان", "گوجه", "سیر", "تخم‌مرغ", "روغن زیتون"],
        "allergens": ["تخم‌مرغ"],
        "aliases": ["میرزا قاسمی", "میرزاقاسمی"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "pepperoni-pizza",
        "name": "پیتزا پپرونی",
        "category": "فست‌فود",
        "price_toman": 320_000,
        "description": "پیتزای ۳۰ سانتی با پپرونی، پنیر موزارلا و سس گوجه.",
        "ingredients": ["خمیر پیتزا", "پپرونی", "پنیر موزارلا", "سس گوجه"],
        "allergens": ["گلوتن", "شیر"],
        "aliases": ["پپرونی", "پیتزا پپرونی"],
        "is_spicy": True,
        "temperature": "hot",
    },
    {
        "key": "margherita-pizza",
        "name": "پیتزا مارگاریتا",
        "category": "فست‌فود",
        "price_toman": 280_000,
        "description": "پیتزای ۳۰ سانتی با پنیر موزارلا، گوجه و ریحان تازه.",
        "ingredients": ["خمیر پیتزا", "پنیر موزارلا", "گوجه", "ریحان"],
        "allergens": ["گلوتن", "شیر"],
        "aliases": ["مارگاریتا", "پیتزا مارگاریتا"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "double-cheeseburger",
        "name": "چیزبرگر دوبل",
        "category": "فست‌فود",
        "price_toman": 290_000,
        "description": "دو لایه گوشت گوساله، پنیر چدار، کاهو، گوجه و نان برگر.",
        "ingredients": ["گوشت گوساله", "پنیر چدار", "نان برگر", "کاهو", "گوجه"],
        "allergens": ["گلوتن", "شیر"],
        "aliases": ["چیز برگر", "برگر", "چیزبرگر"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "spicy-chicken-sandwich",
        "name": "ساندویچ مرغ تند",
        "category": "فست‌فود",
        "price_toman": 280_000,
        "description": "ساندویچ مرغ با سس تند و کاهو.",
        "ingredients": ["نان", "مرغ", "سس تند", "کاهو"],
        "allergens": ["گلوتن"],
        "aliases": ["ساندویچ مرغ", "مرغ تند"],
        "is_spicy": True,
        "temperature": "hot",
    },
    {
        "key": "french-fries",
        "name": "سیب‌زمینی سرخ‌کرده",
        "category": "فست‌فود",
        "price_toman": 120_000,
        "description": "سیب‌زمینی سرخ‌کرده با سس مخصوص.",
        "ingredients": ["سیب‌زمینی", "سس مخصوص"],
        "allergens": [],
        "aliases": ["سیب زمینی", "فرایز", "سیب‌زمینی"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "special-hotdog",
        "name": "هات‌داگ ویژه",
        "category": "فست‌فود",
        "price_toman": 240_000,
        "description": "هات‌داگ با سوسیس گوشت، پنیر، خیارشور و سس.",
        "ingredients": ["نان هات‌داگ", "سوسیس گوشت", "پنیر", "خیارشور", "سس"],
        "allergens": ["گلوتن", "شیر"],
        "aliases": ["هات داگ", "هاتداگ"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "lemonade",
        "name": "لیموناد",
        "category": "نوشیدنی سرد",
        "price_toman": 95_000,
        "description": "نوشیدنی خنک با آب‌لیمو، نعناع و شکر.",
        "ingredients": ["آب‌لیمو", "نعناع", "آب", "شکر"],
        "allergens": [],
        "aliases": ["لیموناد سنتی", "لیموناد نعناع"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "cola",
        "name": "نوشابه کوکا",
        "category": "نوشیدنی سرد",
        "price_toman": 60_000,
        "description": "نوشابه قوطی کوکاکولا.",
        "ingredients": ["نوشابه گازدار"],
        "allergens": [],
        "aliases": ["کوکا", "کوکاکولا", "نوشابه"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "doogh",
        "name": "دوغ سنتی",
        "category": "نوشیدنی سرد",
        "price_toman": 65_000,
        "description": "دوغ گازدار با نعناع و پودر کوهی.",
        "ingredients": ["ماست", "آب", "نعناع", "نمک"],
        "allergens": ["شیر"],
        "aliases": ["دوغ", "آیران"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "fresh-orange-juice",
        "name": "آب‌پرتقال تازه",
        "category": "نوشیدنی سرد",
        "price_toman": 95_000,
        "description": "آب‌پرتقال تازه و طبیعی.",
        "ingredients": ["پرتقال"],
        "allergens": [],
        "aliases": ["آب پرتقال", "آبمیوه"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "chocolate-shake",
        "name": "شیک شکلات",
        "category": "نوشیدنی سرد",
        "price_toman": 145_000,
        "description": "شیک شکلات با شیر و بستنی.",
        "ingredients": ["شیر", "بستنی", "شکلات"],
        "allergens": ["شیر"],
        "aliases": ["میلک شیک", "شیک"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "espresso",
        "name": "اسپرسو",
        "category": "نوشیدنی گرم",
        "price_toman": 90_000,
        "description": "اسپرسوی تک‌شات با کافئین بالا.",
        "ingredients": ["اسپرسو"],
        "allergens": [],
        "aliases": ["قهوه"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "latte",
        "name": "لاته",
        "category": "نوشیدنی گرم",
        "price_toman": 145_000,
        "description": "اسپرسو همراه با شیر بخار داده‌شده.",
        "ingredients": ["اسپرسو", "شیر"],
        "allergens": ["شیر"],
        "aliases": ["کافه لاته", "لاته"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "cappuccino",
        "name": "کاپوچینو",
        "category": "نوشیدنی گرم",
        "price_toman": 110_000,
        "description": "اسپرسو با شیر بخار و فوم شیر.",
        "ingredients": ["اسپرسو", "شیر"],
        "allergens": ["شیر"],
        "aliases": ["کاپوچینو"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "black-tea",
        "name": "چای سیاه",
        "category": "نوشیدنی گرم",
        "price_toman": 45_000,
        "description": "چای سیاه دم‌کرده با نبات.",
        "ingredients": ["چای سیاه", "نبات"],
        "allergens": [],
        "aliases": ["چای"],
        "is_spicy": False,
        "temperature": "hot",
    },
    {
        "key": "chocolate-cookie",
        "name": "کوکی شکلاتی",
        "category": "دسر",
        "price_toman": 95_000,
        "description": "کوکی تازه با تکه‌های شکلات.",
        "ingredients": ["آرد", "کره", "شکر", "شکلات"],
        "allergens": ["گلوتن", "شیر", "تخم‌مرغ"],
        "aliases": ["کوکی", "کوکی شکلاتی"],
        "is_spicy": False,
        "temperature": "room_temperature",
    },
    {
        "key": "new-york-cheesecake",
        "name": "چیزکیک نیویورکی",
        "category": "دسر",
        "price_toman": 150_000,
        "description": "چیزکیک خامه‌ای با سس توت‌فرنگی.",
        "ingredients": ["پنیر خامه‌ای", "بیسکویت", "تخم‌مرغ", "توت‌فرنگی"],
        "allergens": ["گلوتن", "شیر", "تخم‌مرغ"],
        "aliases": ["چیز کیک", "چیزکیک"],
        "is_spicy": False,
        "temperature": "cold",
    },
    {
        "key": "saffron-ice-cream",
        "name": "بستنی سنتی زعفرانی",
        "category": "دسر",
        "price_toman": 120_000,
        "description": "بستنی سنتی زعفرانی با پسته و خلال بادام.",
        "ingredients": ["شیر", "خامه", "زعفران", "پسته", "بادام"],
        "allergens": ["شیر", "پسته", "بادام"],
        "aliases": ["بستنی سنتی", "بستنی زعفرانی"],
        "is_spicy": False,
        "temperature": "cold",
    },
]

# کلیدهای قدیمی که در دیتابیس نمونه ساخته شده بودند.
LEGACY_KEY_RENAMES = {
    "item-1794083552855": "chocolate-cookie",
    "item-1794105915035": "joojeh-kabab",
    "item-1794119463511": "cola",
}

NAME_TO_KEY = {
    normalize_menu_text(name): key
    for name, key in [
        ("کوکی", "chocolate-cookie"),
        ("چلو جوجه کباب", "joojeh-kabab"),
        ("نوشابه کوکا", "cola"),
        ("نوشابه کوکاکولا", "cola"),
        ("لیموناد", "lemonade"),
        ("ساندویچ مرغ تند", "spicy-chicken-sandwich"),
    ]
}


async def rename_legacy_items(session, restaurant_id: int) -> None:
    """تبدیل کلیدهای قدیمی/تصادفی به slugهای پایدار و انگلیسی."""
    result = await session.execute(
        select(MenuItemModel).where(MenuItemModel.restaurant_id == restaurant_id)
    )
    items = list(result.scalars())
    existing_keys = {item.item_key for item in items}

    for item in items:
        target_key = LEGACY_KEY_RENAMES.get(item.item_key)
        if target_key is None:
            target_key = NAME_TO_KEY.get(normalize_menu_text(item.name))
        if (
            not target_key
            or target_key == item.item_key
            or target_key in existing_keys
        ):
            continue
        existing_keys.discard(item.item_key)
        existing_keys.add(target_key)
        item.item_key = target_key

    await session.flush()


async def seed_demo_menu() -> None:
    await init_db()

    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for image_path in DATA_DIR.glob("*.jpg"):
        shutil.copy2(image_path, settings.UPLOAD_DIR / image_path.name)

    async with AsyncSessionLocal() as session:
        restaurant = (
            await session.execute(
                select(RestaurantModel).where(RestaurantModel.slug == "demo")
            )
        ).scalar_one_or_none()
        if restaurant is None:
            raise RuntimeError("رستوران demo پیدا نشد؛ ابتدا init_db را اجرا کنید.")

        await rename_legacy_items(session, restaurant.id)

        category_result = await session.execute(
            select(MenuCategoryModel).where(
                MenuCategoryModel.restaurant_id == restaurant.id
            )
        )
        categories = {category.name: category for category in category_result.scalars()}
        for name, sort_order in CATEGORIES:
            category = categories.get(name)
            if category is None:
                category = MenuCategoryModel(
                    restaurant_id=restaurant.id,
                    name=name,
                    sort_order=sort_order,
                )
                session.add(category)
                categories[name] = category
            else:
                category.sort_order = sort_order

        await session.flush()

        item_result = await session.execute(
            select(MenuItemModel).where(MenuItemModel.restaurant_id == restaurant.id)
        )
        existing_items = {item.item_key: item for item in item_result.scalars()}

        category_counters: defaultdict[str, int] = defaultdict(int)
        for spec in ITEMS:
            category_name = spec["category"]
            category_counters[category_name] += 1

            item = existing_items.get(spec["key"])
            if item is None:
                item = MenuItemModel(
                    restaurant_id=restaurant.id,
                    item_key=spec["key"],
                )
                session.add(item)
                existing_items[spec["key"]] = item

            item.name = spec["name"]
            item.category = category_name
            item.description = spec["description"]
            item.price_amount = spec["price_toman"] * 10
            item.price_currency = "IRR"
            item.ingredients = spec["ingredients"]
            item.allergens = spec["allergens"]
            item.aliases = spec["aliases"]
            item.is_spicy = spec["is_spicy"]
            item.serving_temperature = spec["temperature"]
            item.is_available = True
            item.sort_order = category_counters[category_name]

            image_path = settings.UPLOAD_DIR / f"{spec['key']}.jpg"
            if image_path.exists():
                item.image_filename = image_path.name

        await session.flush()

        counts_result = await session.execute(
            select(MenuItemModel.category, func.count())
            .where(MenuItemModel.restaurant_id == restaurant.id)
            .group_by(MenuItemModel.category)
        )
        counts = {category: count for category, count in counts_result.all()}

        # حذف دسته‌بندی‌های خالی و بی‌استفاده (مثل دستهٔ آزمایشی قبلی).
        for category_name in ("gyjtyjf", "غذای گرم"):
            category = categories.get(category_name)
            if category is not None and counts.get(category_name, 0) == 0:
                await session.delete(category)

        await session.commit()

        total_items = len(ITEMS)
        print(
            f"منوی نمونه به‌روزرسانی شد: {total_items} آیتم در "
            f"{len(CATEGORIES)} دسته‌بندی."
        )
        print(f"تصاویر در {settings.UPLOAD_DIR} کپی شدند.")


if __name__ == "__main__":
    asyncio.run(seed_demo_menu())
