from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.menu_repository import SqlAlchemyMenuRepository
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
async def get_restaurant_menu(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
) -> RestaurantMenu:
    # ساخت Repository مرتبط با دیتابیس همین درخواست
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return menu