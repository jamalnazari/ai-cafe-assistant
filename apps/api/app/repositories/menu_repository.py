from typing import Protocol

from app.schemas.menu import RestaurantMenu


class MenuRepository(Protocol):
    """قرارداد خواندن منوی رستوران."""

    def get_by_restaurant_slug(
        self,
        restaurant_slug: str,
    ) -> RestaurantMenu | None:
        ...


class InMemoryMenuRepository:
    """پیاده‌سازی آزمایشی repository با استفاده از حافظه."""

    def __init__(self, menus: list[RestaurantMenu]) -> None:
        self._menus_by_slug: dict[str, RestaurantMenu] = {}

        for menu in menus:
            if menu.restaurant_slug in self._menus_by_slug:
                raise ValueError(
                    f"Duplicate restaurant slug: {menu.restaurant_slug}"
                )

            self._menus_by_slug[menu.restaurant_slug] = menu

    def get_by_restaurant_slug(
        self,
        restaurant_slug: str,
    ) -> RestaurantMenu | None:
        return self._menus_by_slug.get(restaurant_slug)