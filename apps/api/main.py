from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.user import UserModel
from app.core.security import verify_password
from app.repositories.menu_repository import SqlAlchemyMenuRepository
from app.schemas.menu import RestaurantMenu, MenuItemCreate
from app.services.assistant_service import AssistantService

app = FastAPI(
    title="Cafe Voice Assistant API",
    version="0.1.0",
)

assistant_service = AssistantService()


class LoginRequest(BaseModel):
    email: str
    password: str


class TextQuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    transcript: str | None = None
    answer: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# --- لاگین صاحب کافه ---
@app.post("/api/v1/auth/login")
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserModel).where(UserModel.email == body.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ایمیل یا رمز عبور اشتباه است.",
        )

    return {"message": "ورود موفقیت‌آمیز بود", "email": user.email}


# --- دریافت منو ---
@app.get(
    "/api/v1/restaurants/{restaurant_slug}/menu",
    response_model=RestaurantMenu,
)
async def get_restaurant_menu(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
) -> RestaurantMenu:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return menu


# --- افزودن آیتم جدید به منو توسط مدیر ---
@app.post("/api/v1/restaurants/{restaurant_slug}/items")
async def create_menu_item(
    restaurant_slug: str,
    item_data: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RestaurantModel).where(RestaurantModel.slug == restaurant_slug)
    )
    restaurant = result.scalar_one_or_none()

    if not restaurant:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    new_item = MenuItemModel(
        restaurant_id=restaurant.id,
        item_key=item_data.item_key,
        name=item_data.name,
        category=item_data.category,
        description=item_data.description,
        price_amount=item_data.price_amount,
        ingredients=item_data.ingredients,
        allergens=item_data.allergens,
        is_spicy=item_data.is_spicy,
        serving_temperature=item_data.serving_temperature,
        is_available=item_data.is_available,
    )
    db.add(new_item)
    await db.commit()
    return {"message": "آیتم جدید با موفقیت اضافه شد."}


# --- حذف آیتم از منو ---
@app.delete("/api/v1/restaurants/{restaurant_slug}/items/{item_key}")
async def delete_menu_item(
    restaurant_slug: str,
    item_key: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RestaurantModel)
        .where(RestaurantModel.slug == restaurant_slug)
        .options(selectinload(RestaurantModel.items))
    )
    restaurant = result.scalar_one_or_none()

    if not restaurant:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    target_item = next((i for i in restaurant.items if i.item_key == item_key), None)
    if not target_item:
        raise HTTPException(status_code=404, detail="آیتم یافت نشد.")

    await db.delete(target_item)
    await db.commit()
    return {"message": "آیتم حذف شد."}


# --- پرسش متنی ---
@app.post(
    "/api/v1/restaurants/{restaurant_slug}/ask-text",
    response_model=QuestionResponse,
)
async def ask_text_question(
    restaurant_slug: str,
    body: TextQuestionRequest,
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    answer = await assistant_service.answer_text_question(menu, body.question)
    return QuestionResponse(answer=answer)


# --- پرسش صوتی ---
@app.post(
    "/api/v1/restaurants/{restaurant_slug}/ask-voice",
    response_model=QuestionResponse,
)
async def ask_voice_question(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    audio_bytes = await file.read()
    transcript, answer = await assistant_service.answer_voice_question(
        menu, audio_bytes, file.filename or "audio.webm"
    )
    return QuestionResponse(transcript=transcript, answer=answer)