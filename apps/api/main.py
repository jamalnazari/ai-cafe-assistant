from fastapi import FastAPI, HTTPException

from app.data.demo_menu import DEMO_MENU
from app.schemas.menu import RestaurantMenu


app = FastAPI(
    title="Cafe Voice Assistant API",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/v1/restaurants/{restaurant_slug}/menu",
    response_model=RestaurantMenu,
)
def get_restaurant_menu(restaurant_slug: str) -> RestaurantMenu:
    if restaurant_slug != DEMO_MENU.restaurant_slug:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return DEMO_MENU