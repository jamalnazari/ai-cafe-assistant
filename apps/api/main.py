from fastapi import FastAPI, HTTPException

from app.data.demo_menu import DEMO_MENU
from app.repositories.menu_repository import (
    InMemoryMenuRepository,
    MenuRepository,
)
from app.schemas.menu import RestaurantMenu


app = FastAPI(
    title="Cafe Voice Assistant API",
    version="0.1.0",
)

# اینجا محل ساخت و وصل‌کردن اجزای برنامه است.
menu_repository: MenuRepository = InMemoryMenuRepository(
    menus=[DEMO_MENU],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/v1/restaurants/{restaurant_slug}/menu",
    response_model=RestaurantMenu,
)
def get_restaurant_menu(restaurant_slug: str) -> RestaurantMenu:
    menu = menu_repository.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return menu