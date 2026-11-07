from typing import Protocol
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.restaurant import RestaurantModel
from app.schemas.menu import MenuItem, Price, RestaurantMenu


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
                RestaurantModel.is_active == True,
            )
            .options(selectinload(RestaurantModel.items))
        )
        result = await self.session.execute(stmt)
        restaurant = result.scalar_one_or_none()

        if restaurant is None:
            return None

        # تبدیل داده‌های ORM دیتابیس به اسکیمای استاندارد Pydantic
        items = [
            MenuItem(
                id=item.item_key,
                name=item.name,
                category=item.category,
                description=item.description,
                ingredients=item.ingredients,
                allergens=item.allergens,
                is_spicy=item.is_spicy,
                serving_temperature=item.serving_temperature,  # type: ignore
                price=Price(amount=item.price_amount, currency=item.price_currency),
                is_available=item.is_available,
            )
            for item in restaurant.items
        ]

        return RestaurantMenu(
            restaurant_slug=restaurant.slug,
            restaurant_name=restaurant.name,
            items=items,
        )