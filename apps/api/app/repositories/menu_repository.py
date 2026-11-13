from typing import Protocol
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurant import RestaurantModel
from app.schemas.menu import MenuItem, Price, RestaurantMenu
from app.services.branding_image_service import branding_image_service
from app.services.menu_image_service import menu_image_service


class MenuRepository(Protocol):
    """قرارداد خواندن منوی رستوران"""

    async def get_by_restaurant_slug(
        self,
        restaurant_slug: str,
    ) -> RestaurantMenu | None:
        ...


class SqlAlchemyMenuRepository:
    """پیاده‌سازی واقعی Repository با استفاده از SQLAlchemy و دیتابیس"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_restaurant_slug(
        self,
        restaurant_slug: str,
    ) -> RestaurantMenu | None:
        # کوئری برای پیدا کردن کافه با اسلاگ مشخص همراه با آیتم‌های منو
        stmt = (
            select(RestaurantModel)
            .where(
                RestaurantModel.slug == restaurant_slug,
                RestaurantModel.is_active.is_(True),
            )
            .options(
                selectinload(RestaurantModel.items),
                selectinload(RestaurantModel.categories),
            )
        )
        result = await self.session.execute(stmt)
        restaurant = result.scalar_one_or_none()

        if restaurant is None:
            return None

        category_names = [category.name for category in restaurant.categories]
        for item in restaurant.items:
            if item.category not in category_names:
                category_names.append(item.category)

        # آیتم‌ها به ترتیب دسته‌بندی و سپس ترتیب تعریف‌شده در هر دسته برگردانده
        # می‌شوند تا خروجی API و پرامپت LLM هر دو ساخت‌یافته و قابل پیش‌بینی باشند.
        category_order = {
            category_name: index
            for index, category_name in enumerate(category_names)
        }
        ordered_items = sorted(
            restaurant.items,
            key=lambda item: (
                category_order.get(item.category, len(category_names)),
                item.sort_order,
                item.id,
            ),
        )

        # تبدیل داده‌های ORM دیتابیس به اسکیمای استاندارد Pydantic
        items = [
            MenuItem(
                id=item.item_key,
                name=item.name,
                category=item.category,
                description=item.description,
                image_url=menu_image_service.get_image_url(item.image_filename),
                ingredients=item.ingredients,
                allergens=item.allergens,
                aliases=item.aliases,
                is_spicy=item.is_spicy,
                serving_temperature=item.serving_temperature,  # type: ignore
                price=Price(amount=item.price_amount, currency=item.price_currency),
                is_available=item.is_available,
            )
            for item in ordered_items
        ]

        return RestaurantMenu(
            restaurant_slug=restaurant.slug,
            restaurant_name=restaurant.name,
            restaurant_label=restaurant.label_word or "کافه",
            logo_url=branding_image_service.get_image_url(restaurant.logo_filename),
            background_url=branding_image_service.get_image_url(
                restaurant.background_filename
            ),
            restaurant_about=restaurant.about_text,
            categories=category_names,
            items=items,
        )