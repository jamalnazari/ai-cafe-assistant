from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.user import UserModel
from app.core.config import settings
from app.core.auth import (
    auth_service,
    clear_session_cookie,
    get_current_owner,
    set_session_cookie,
)
from app.repositories.menu_repository import SqlAlchemyMenuRepository
from app.schemas.auth import LoginRequest, LoginResponse, OwnerResponse
from app.schemas.chat import TextQuestionRequest
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuItemCreate,
    MenuItemUpdate,
    RestaurantMenu,
)
from app.services.assistant_service import AssistantService
from app.services.menu_image_service import menu_image_service

app = FastAPI(
    title="Cafe Voice Assistant API",
    version="0.1.0",
)

settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/v1/uploads/menu-items",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="menu-item-images",
)

assistant_service = AssistantService()


class QuestionResponse(BaseModel):
    transcript: str | None = None
    answer: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# --- احراز هویت صاحب کافه ---
@app.post("/api/v1/auth/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    user = await auth_service.authenticate_owner(
        db, str(body.email), body.password
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ایمیل یا رمز عبور اشتباه است.",
        )

    token, expires_at = await auth_service.create_session(db, user)
    set_session_cookie(response, token, expires_at)
    return LoginResponse(message="ورود موفقیت‌آمیز بود.", email=user.email)


@app.get("/api/v1/auth/me", response_model=OwnerResponse)
async def get_authenticated_owner(
    current_owner: UserModel = Depends(get_current_owner),
) -> OwnerResponse:
    return OwnerResponse(email=current_owner.email)


@app.post("/api/v1/auth/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    await auth_service.revoke_session(db, token)
    clear_session_cookie(response)
    return {"message": "با موفقیت از حساب خارج شدید."}


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


async def category_exists(
    db: AsyncSession, restaurant_id: int, category_name: str
) -> bool:
    result = await db.execute(
        select(MenuCategoryModel).where(
            MenuCategoryModel.restaurant_id == restaurant_id,
            MenuCategoryModel.name == category_name,
        )
    )
    return result.scalar_one_or_none() is not None


# --- ساخت دسته‌بندی جدید توسط مالک ---
@app.post("/api/v1/restaurants/{restaurant_slug}/categories")
async def create_menu_category(
    restaurant_slug: str,
    category_data: MenuCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str]:
    result = await db.execute(
        select(RestaurantModel).where(RestaurantModel.slug == restaurant_slug)
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    if await category_exists(db, restaurant.id, category_data.name):
        raise HTTPException(status_code=409, detail="این دسته‌بندی قبلاً ساخته شده است.")

    db.add(
        MenuCategoryModel(restaurant_id=restaurant.id, name=category_data.name)
    )
    await db.commit()
    return {"message": "دسته‌بندی جدید ساخته شد.", "name": category_data.name}


# --- افزودن آیتم جدید به منو توسط مدیر ---
@app.post("/api/v1/restaurants/{restaurant_slug}/items")
async def create_menu_item(
    restaurant_slug: str,
    item_data: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
):
    result = await db.execute(
        select(RestaurantModel).where(RestaurantModel.slug == restaurant_slug)
    )
    restaurant = result.scalar_one_or_none()

    if not restaurant:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    category_name = item_data.category.strip()
    if not category_name or not await category_exists(db, restaurant.id, category_name):
        raise HTTPException(
            status_code=400,
            detail="دسته‌بندی معتبر نیست؛ ابتدا دسته‌بندی را بسازید.",
        )

    new_item = MenuItemModel(
        restaurant_id=restaurant.id,
        item_key=item_data.item_key,
        name=item_data.name,
        category=category_name,
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


# --- ویرایش اطلاعات آیتم توسط مالک ---
@app.patch("/api/v1/restaurants/{restaurant_slug}/items/{item_key}")
async def update_menu_item(
    restaurant_slug: str,
    item_key: str,
    item_data: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str]:
    result = await db.execute(
        select(MenuItemModel)
        .join(RestaurantModel)
        .where(
            RestaurantModel.slug == restaurant_slug,
            MenuItemModel.item_key == item_key,
        )
    )
    target_item = result.scalar_one_or_none()
    if target_item is None:
        raise HTTPException(status_code=404, detail="آیتم یافت نشد.")

    updates = item_data.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="فیلدی برای ویرایش ارسال نشده است.")

    if "category" in updates:
        category_name = updates["category"].strip()
        if not category_name or not await category_exists(
            db, target_item.restaurant_id, category_name
        ):
            raise HTTPException(
                status_code=400,
                detail="دسته‌بندی معتبر نیست؛ ابتدا دسته‌بندی را بسازید.",
            )
        updates["category"] = category_name

    for field_name, value in updates.items():
        setattr(target_item, field_name, value)
    await db.commit()
    return {"message": "آیتم با موفقیت ویرایش شد."}


# --- افزودن یا تعویض تصویر آیتم توسط مالک ---
@app.post("/api/v1/restaurants/{restaurant_slug}/items/{item_key}/image")
async def upload_menu_item_image(
    restaurant_slug: str,
    item_key: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str]:
    result = await db.execute(
        select(MenuItemModel)
        .join(RestaurantModel)
        .where(
            RestaurantModel.slug == restaurant_slug,
            MenuItemModel.item_key == item_key,
        )
    )
    target_item = result.scalar_one_or_none()
    if target_item is None:
        raise HTTPException(status_code=404, detail="آیتم یافت نشد.")

    new_filename = await menu_image_service.save_image(file)
    old_filename = target_item.image_filename
    target_item.image_filename = new_filename
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        menu_image_service.delete_image(new_filename)
        raise

    menu_image_service.delete_image(old_filename)
    return {
        "message": "تصویر آیتم با موفقیت ذخیره شد.",
        "image_url": menu_image_service.get_image_url(new_filename) or "",
    }


# --- حذف آیتم از منو ---
@app.delete("/api/v1/restaurants/{restaurant_slug}/items/{item_key}")
async def delete_menu_item(
    restaurant_slug: str,
    item_key: str,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
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

    image_filename = target_item.image_filename
    await db.delete(target_item)
    await db.commit()
    menu_image_service.delete_image(image_filename)
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

    answer = await assistant_service.answer_text_question(
        menu, body.question, body.history
    )
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