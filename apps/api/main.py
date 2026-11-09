import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.init_db import ensure_schema_columns
from app.db.session import AsyncSessionLocal, engine, get_db
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.user import UserModel
from app.core.config import DEFAULT_OWNER_PASSWORD, settings
from app.core.security import verify_password
from app.core.auth import (
    auth_service,
    clear_session_cookie,
    get_current_owner,
    set_session_cookie,
)
from app.core.rate_limit import enforce_ask_rate_limit, enforce_login_rate_limit
from app.providers.llm import LLMUnavailableError
from app.repositories.menu_repository import SqlAlchemyMenuRepository
from app.schemas.auth import LoginRequest, LoginResponse, OwnerResponse
from app.schemas.chat import TextQuestionRequest
from app.schemas.menu import (
    MenuCategoryCreate,
    RestaurantUpdate,
    MenuItem as MenuItemSchema,
    MenuItemCreate,
    MenuItemUpdate,
    RestaurantMenu,
)
from app.services.assistant_service import AssistantService
from app.services.branding_image_service import branding_image_service
from app.services.menu_image_service import menu_image_service
from app.services.menu_recommendation import find_mentioned_items

logger = logging.getLogger("cafe.api")

# پیش از ساخت اپلیکیشن، تنظیمات حساس بررسی می‌شود تا سرویس با کلید ناایمن بالا نیاید.
settings.validate_startup()


async def warn_if_default_owner_password() -> None:
    """در production یادآوری می‌کند رمز پیش‌فرض مالک هنوز تغییر نکرده است."""
    if not settings.is_production:
        return
    try:
        async with AsyncSessionLocal() as session:
            owner = await session.scalar(
                select(UserModel).where(UserModel.email == "owner@cafe.com")
            )
    except Exception as exc:  # noqa: BLE001 - نبود جدول نباید مانع بالا آمدن سرویس شود
        logger.warning("بررسی رمز پیش‌فرض مالک ممکن نشد: %s", exc)
        return

    if owner is not None and verify_password(
        DEFAULT_OWNER_PASSWORD, owner.password_hash
    ):
        logger.warning(
            "رمز صاحب کافه هنوز رمز پیش‌فرض است. برای تغییر آن اجرا کنید: "
            "python -m app.db.set_owner_password"
        )


async def apply_schema_updates() -> None:
    """دیتابیس‌های قبلی را بدون حذف داده با ستون‌های جدید هم‌خوان می‌کند."""
    if not settings.AUTO_MIGRATE_SCHEMA:
        return
    try:
        async with engine.begin() as connection:
            await ensure_schema_columns(connection)
    except Exception as exc:  # noqa: BLE001 - نبود دیتابیس نباید سرویس را بخواباند
        logger.error("به‌روزرسانی ساختار دیتابیس ناموفق بود: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await apply_schema_updates()
    await warn_if_default_owner_password()
    yield


app = FastAPI(
    title="Cafe Voice Assistant API",
    version=settings.VERSION,
    lifespan=lifespan,
    # در محیط production مستندات تعاملی API برای عموم بسته است.
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
)

if settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.BRANDING_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/v1/uploads/menu-items",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="menu-item-images",
)
app.mount(
    "/api/v1/uploads/branding",
    StaticFiles(directory=settings.BRANDING_UPLOAD_DIR),
    name="restaurant-branding",
)

assistant_service = AssistantService()


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """خطاهای پیش‌بینی‌نشده با پیام فارسی و بدون افشای جزئیات داخلی برگردانده می‌شوند."""
    logger.exception("خطای پیش‌بینی‌نشده در مسیر %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "خطای غیرمنتظره‌ای رخ داد؛ لطفاً دوباره تلاش کنید."},
    )


class QuestionResponse(BaseModel):
    transcript: str | None = None
    answer: str
    # آیتم‌هایی از منو که در پاسخ به آن‌ها اشاره شده است؛ برای نمایش تصویر
    # پیشنهادها در رابط مشتری و جلوگیری از ساخت آیتم خیالی توسط LLM.
    recommended_items: list[MenuItemSchema] = Field(default_factory=list)


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """بررسی سلامت سرویس و اتصال دیتابیس (برای مانیتورینگ و پروکسی)."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - هر خطای دیتابیس یعنی سرویس ناسالم است
        logger.exception("بررسی سلامت دیتابیس ناموفق بود: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="دیتابیس در دسترس نیست.",
        ) from exc
    return {"status": "ok", "database": "ok"}


# --- احراز هویت صاحب کافه ---
@app.post("/api/v1/auth/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(enforce_login_rate_limit),
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


# --- هویت کافه (نام، لوگو، پس‌زمینه) ---
async def get_restaurant_or_404(
    db: AsyncSession, restaurant_slug: str
) -> RestaurantModel:
    restaurant = await db.scalar(
        select(RestaurantModel).where(RestaurantModel.slug == restaurant_slug)
    )
    if restaurant is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")
    return restaurant


async def replace_branding_image(
    db: AsyncSession,
    restaurant: RestaurantModel,
    field: str,
    file: UploadFile,
) -> str:
    """تصویر جدید را ذخیره، به رکورد وصل و تصویر قبلی را پاک می‌کند."""
    filename = await branding_image_service.save_image(file)
    previous_filename = getattr(restaurant, field)
    setattr(restaurant, field, filename)
    try:
        await db.commit()
    except Exception:
        branding_image_service.delete_image(filename)
        raise
    branding_image_service.delete_image(previous_filename)
    return filename


async def clear_branding_image(
    db: AsyncSession, restaurant: RestaurantModel, field: str
) -> None:
    previous_filename = getattr(restaurant, field)
    if not previous_filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="تصویری برای حذف ثبت نشده است.",
        )
    setattr(restaurant, field, None)
    await db.commit()
    branding_image_service.delete_image(previous_filename)


@app.patch("/api/v1/restaurants/{restaurant_slug}")
async def update_restaurant(
    restaurant_slug: str,
    body: RestaurantUpdate,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str | None]:
    """به‌روزرسانی نام کافه و/یا توضیحات «دربارهٔ مجموعه»."""
    restaurant = await get_restaurant_or_404(db, restaurant_slug)

    if body.name is not None:
        restaurant.name = body.name
    if "about" in body.model_fields_set:
        # مقدار خالی (None پس از اعتبارسنجی) یعنی پاک‌کردن توضیحات.
        restaurant.about_text = body.about

    await db.commit()
    return {
        "message": "اطلاعات کافه به‌روزرسانی شد.",
        "name": restaurant.name,
        "about": restaurant.about_text,
    }


@app.post("/api/v1/restaurants/{restaurant_slug}/logo")
async def upload_restaurant_logo(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str | None]:
    restaurant = await get_restaurant_or_404(db, restaurant_slug)
    filename = await replace_branding_image(db, restaurant, "logo_filename", file)
    return {
        "message": "لوگوی کافه به‌روزرسانی شد.",
        "logo_url": branding_image_service.get_image_url(filename),
    }


@app.delete("/api/v1/restaurants/{restaurant_slug}/logo")
async def delete_restaurant_logo(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str | None]:
    restaurant = await get_restaurant_or_404(db, restaurant_slug)
    await clear_branding_image(db, restaurant, "logo_filename")
    return {"message": "لوگوی کافه حذف شد.", "logo_url": None}


@app.post("/api/v1/restaurants/{restaurant_slug}/background")
async def upload_restaurant_background(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str | None]:
    restaurant = await get_restaurant_or_404(db, restaurant_slug)
    filename = await replace_branding_image(
        db, restaurant, "background_filename", file
    )
    return {
        "message": "تصویر پس‌زمینهٔ کافه به‌روزرسانی شد.",
        "background_url": branding_image_service.get_image_url(filename),
    }


@app.delete("/api/v1/restaurants/{restaurant_slug}/background")
async def delete_restaurant_background(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, str | None]:
    restaurant = await get_restaurant_or_404(db, restaurant_slug)
    await clear_branding_image(db, restaurant, "background_filename")
    return {"message": "تصویر پس‌زمینهٔ کافه حذف شد.", "background_url": None}


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
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

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

    sort_order = category_data.sort_order
    if sort_order == 0:
        max_sort_order = await db.scalar(
            select(func.max(MenuCategoryModel.sort_order)).where(
                MenuCategoryModel.restaurant_id == restaurant.id
            )
        )
        sort_order = (max_sort_order or 0) + 10

    db.add(
        MenuCategoryModel(
            restaurant_id=restaurant.id,
            name=category_data.name,
            sort_order=sort_order,
        )
    )
    await db.commit()
    return {"message": "دسته‌بندی جدید ساخته شد.", "name": category_data.name}


# --- حذف دسته‌بندی توسط مالک ---
@app.delete("/api/v1/restaurants/{restaurant_slug}/categories/{category_name}")
async def delete_menu_category(
    restaurant_slug: str,
    category_name: str,
    strategy: Literal["fail", "delete_items", "move"] = Query(
        default="fail",
        description="رفتار با آیتم‌های داخل دسته‌بندی هنگام حذف",
    ),
    move_to: str | None = Query(
        default=None,
        description="نام دسته‌بندی مقصد هنگام استفاده از استراتژی move",
    ),
    db: AsyncSession = Depends(get_db),
    _current_owner: UserModel = Depends(get_current_owner),
) -> dict[str, object]:
    restaurant_result = await db.execute(
        select(RestaurantModel)
        .where(RestaurantModel.slug == restaurant_slug)
        .options(selectinload(RestaurantModel.items))
    )
    restaurant = restaurant_result.scalar_one_or_none()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    category = await db.execute(
        select(MenuCategoryModel).where(
            MenuCategoryModel.restaurant_id == restaurant.id,
            MenuCategoryModel.name == category_name,
        )
    )
    target_category = category.scalar_one_or_none()
    category_items = [
        item for item in restaurant.items if item.category == category_name
    ]

    if target_category is None and not category_items:
        raise HTTPException(status_code=404, detail="دسته‌بندی یافت نشد.")

    if category_items and strategy == "fail":
        raise HTTPException(
            status_code=409,
            detail=(
                f"این دسته‌بندی {len(category_items)} آیتم دارد؛ ابتدا آیتم‌ها را "
                "به دسته‌بندی دیگری منتقل کنید یا حذف دسته‌بندی همراه با آیتم‌ها "
                "را انتخاب کنید."
            ),
        )

    deleted_item_keys: list[str] = []
    image_filenames: list[str] = []

    if category_items and strategy == "move":
        destination = (move_to or "").strip()
        if not destination:
            raise HTTPException(
                status_code=400,
                detail="دسته‌بندی مقصد برای انتقال آیتم‌ها مشخص نشده است.",
            )
        if destination == category_name:
            raise HTTPException(
                status_code=400,
                detail="دسته‌بندی مقصد باید با دسته‌بندی حذف‌شده متفاوت باشد.",
            )
        if not await category_exists(db, restaurant.id, destination):
            raise HTTPException(
                status_code=400,
                detail="دسته‌بندی مقصد معتبر نیست.",
            )
        for item in category_items:
            item.category = destination
    elif category_items and strategy == "delete_items":
        for item in category_items:
            deleted_item_keys.append(item.item_key)
            if item.image_filename:
                image_filenames.append(item.image_filename)
            await db.delete(item)

    if target_category is not None:
        await db.delete(target_category)

    await db.commit()

    for image_filename in image_filenames:
        menu_image_service.delete_image(image_filename)

    return {
        "message": "دسته‌بندی حذف شد.",
        "deleted_item_keys": deleted_item_keys,
        "moved_to": move_to if category_items and strategy == "move" else None,
    }


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

    item_key = item_data.item_key.strip()
    duplicate_item = await db.execute(
        select(MenuItemModel.id).where(
            MenuItemModel.restaurant_id == restaurant.id,
            MenuItemModel.item_key == item_key,
        )
    )
    if duplicate_item.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="آیتمی با این شناسه در منو وجود دارد.",
        )

    new_item = MenuItemModel(
        restaurant_id=restaurant.id,
        item_key=item_key,
        name=item_data.name,
        category=category_name,
        description=item_data.description,
        price_amount=item_data.price_amount,
        ingredients=item_data.ingredients,
        allergens=item_data.allergens,
        aliases=item_data.aliases,
        is_spicy=item_data.is_spicy,
        serving_temperature=item_data.serving_temperature,
        is_available=item_data.is_available,
        sort_order=item_data.sort_order,
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
    _rate_limit: None = Depends(enforce_ask_rate_limit),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    try:
        answer = await assistant_service.answer_text_question(
            menu, body.question, body.history
        )
    except LLMUnavailableError as exc:
        logger.warning("دستیار نتوانست پاسخ تولید کند: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="دستیار هوشمند موقتاً در دسترس نیست؛ لطفاً چند لحظه بعد دوباره بپرسید.",
        ) from exc

    recommended_items = find_mentioned_items(menu, answer)
    return QuestionResponse(
        answer=answer,
        recommended_items=recommended_items,
    )


# --- پرسش صوتی ---
@app.post(
    "/api/v1/restaurants/{restaurant_slug}/ask-voice",
    response_model=QuestionResponse,
)
async def ask_voice_question(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(enforce_ask_rate_limit),
) -> QuestionResponse:
    repo = SqlAlchemyMenuRepository(db)
    menu = await repo.get_by_restaurant_slug(restaurant_slug)

    if menu is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")

    audio_bytes = await file.read()
    try:
        transcript, answer = await assistant_service.answer_voice_question(
            menu, audio_bytes, file.filename or "audio.webm"
        )
    except LLMUnavailableError as exc:
        logger.warning("دستیار نتوانست پاسخ صوتی تولید کند: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="دستیار هوشمند موقتاً در دسترس نیست؛ لطفاً چند لحظه بعد دوباره بپرسید.",
        ) from exc

    recommended_items = find_mentioned_items(menu, answer)
    return QuestionResponse(
        transcript=transcript,
        answer=answer,
        recommended_items=recommended_items,
    )