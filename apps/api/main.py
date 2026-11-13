import logging
import re
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
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.init_db import ensure_admin_user, ensure_schema_columns, link_orphan_owners
from app.db.session import AsyncSessionLocal, engine, get_db
from app.models.auth_session import AuthSessionModel
from app.models.restaurant import RestaurantModel
from app.models.menu import MenuItemModel
from app.models.menu_category import MenuCategoryModel
from app.models.user import UserModel
from app.core.config import DEFAULT_OWNER_PASSWORD, settings
from app.core.identity import is_placeholder_email, placeholder_email
from app.core.security import hash_password, verify_password
from app.core.auth import (
    assert_can_manage_restaurant,
    auth_service,
    clear_session_cookie,
    get_current_admin,
    get_current_owner,
    set_session_cookie,
)
from app.core.rate_limit import enforce_ask_rate_limit, enforce_login_rate_limit
from app.providers.llm import LLMUnavailableError
from app.repositories.menu_repository import SqlAlchemyMenuRepository
from app.schemas.admin import (
    AdminMessage,
    RestaurantAdminOut,
    RestaurantAdminUpdate,
    RestaurantCreate,
)
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


async def ensure_initial_data() -> None:
    """حساب مدیر و اتصال کاربران قدیمی به کافه‌شان را در استارتاپ تضمین می‌کند."""
    steps = (ensure_admin_user, link_orphan_owners)
    for step in steps:
        async with AsyncSessionLocal() as session:
            try:
                await step(session)
                await session.commit()
            except Exception as exc:  # noqa: BLE001 - نبود جدول نباید سرویس را بخواباند
                await session.rollback()
                logger.warning("آماده‌سازی داده‌های اولیه ناموفق بود: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await apply_schema_updates()
    await ensure_initial_data()
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


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """هدرهای امنیتی پایه برای جلوگیری از sniffing و iframe شدن پنل."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    return response

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
    user = await auth_service.authenticate_owner(db, body.identifier, body.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است.",
        )

    token, expires_at = await auth_service.create_session(db, user)
    set_session_cookie(response, token, expires_at)
    payload = await build_user_response(db, user)
    return LoginResponse(message="ورود موفقیت‌میز بود.", **payload.model_dump())


async def build_user_response(
    db: AsyncSession, user: UserModel
) -> OwnerResponse:
    """اطلاعات کاربر همراه با کافهٔ او (برای هدایت پنل در فرانت‌اند)."""
    restaurant = None
    if user.restaurant_id is not None:
        restaurant = await db.scalar(
            select(RestaurantModel).where(RestaurantModel.id == user.restaurant_id)
        )

    return OwnerResponse(
        username=user.username,
        # نشانی جای‌نگهدار (مدیر یا کاربر ساخته‌شده در پنل) نمایش داده نمی‌شود.
        email=(
            None
            if user.role == "admin" or is_placeholder_email(user.email)
            else user.email
        ),
        role=user.role,
        restaurant_slug=restaurant.slug if restaurant else None,
        restaurant_name=restaurant.name if restaurant else None,
        restaurant_label=(restaurant.label_word or "کافه") if restaurant else None,
    )


@app.get("/api/v1/auth/me", response_model=OwnerResponse)
async def get_authenticated_owner(
    current_owner: UserModel = Depends(get_current_owner),
    db: AsyncSession = Depends(get_db),
) -> OwnerResponse:
    return await build_user_response(db, current_owner)


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


async def guard_owner_restaurant(
    restaurant_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_owner),
) -> None:
    """صاحب کافه فقط کافهٔ خودش را مدیریت می‌کند؛ مدیر کل همه را."""
    restaurant = await db.scalar(
        select(RestaurantModel).where(RestaurantModel.slug == restaurant_slug)
    )
    if restaurant is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")
    assert_can_manage_restaurant(current_user, restaurant.id)


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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
) -> dict[str, str | None]:
    restaurant = await get_restaurant_or_404(db, restaurant_slug)
    await clear_branding_image(db, restaurant, "logo_filename")
    return {"message": "لوگوی کافه حذف شد.", "logo_url": None}


@app.post("/api/v1/restaurants/{restaurant_slug}/background")
async def upload_restaurant_background(
    restaurant_slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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
    _owner_guard: None = Depends(guard_owner_restaurant),
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

    # خواندن با سقف حجم: جلوگیری از پر شدن حافظه با فایل صوتی بی‌نهایت بزرگ.
    audio_bytes = await file.read(settings.MAX_AUDIO_UPLOAD_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="فایل صوتی خالی است.")
    if len(audio_bytes) > settings.MAX_AUDIO_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="حجم فایل صوتی نباید بیشتر از ۲۵ مگابایت باشد.",
        )

    try:
        transcript, answer = await assistant_service.answer_voice_question(
            menu, audio_bytes, file.filename or "audio.webm"
        )
    except HTTPException:
        raise
    except LLMUnavailableError as exc:
        logger.warning("دستیار نتوانست پاسخ صوتی تولید کند: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="دستیار هوشمند موقتاً در دسترس نیست؛ لطفاً چند لحظه بعد دوباره بپرسید.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 - هر خطای تبدیل صوت (STT) هم ۵۰۳ می‌شود
        logger.warning("تبدیل صوت به متن ناموفق بود: %s", exc)
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

# --- پنل مدیر سامانه: مدیریت کافه‌ها و کاربران ---
def slugify_value(value: str) -> str:
    """از نام کافه یک نشانی انگلیسی می‌سازد؛ اگر نام فارسی بود، «cafe» می‌شود."""
    lowered = value.strip().lower()
    ascii_part = "".join(
        char if (char.isalnum() and char.isascii()) else "-" for char in lowered
    )
    slug = re.sub(r"-+", "-", ascii_part).strip("-")
    if len(slug) < 3:
        slug = f"cafe-{slug}".strip("-")
    return slug[:40]


async def unique_restaurant_slug(
    db: AsyncSession, base: str, exclude_id: int | None = None
) -> str:
    base = (base or "cafe")[:40] or "cafe"
    candidate = base
    index = 1
    while True:
        existing = await db.scalar(
            select(RestaurantModel).where(RestaurantModel.slug == candidate)
        )
        if existing is None or existing.id == exclude_id:
            return candidate
        # سقف تلاش‌ها تا در بدترین حالت هم درخواستِ ساخت کافه معلق نشود.
        if index > 200:
            raise HTTPException(
                status_code=409,
                detail="ساخت نشانی یکتا ممکن نشد؛ نام دیگری برای کافه انتخاب کنید.",
            )
        suffix = f"-{index}"
        # برای پسوند جا رزرو می‌شود؛ وگرنه برش ۴۰ نویسه‌ای پسوند را حذف می‌کرد،
        # نامزد تکراری همیشه رد می‌شد و حلقه بی‌پایان می‌شد.
        candidate = f"{base[: 40 - len(suffix)]}{suffix}"
        index += 1


async def owner_of_restaurant(
    db: AsyncSession, restaurant_id: int
) -> UserModel | None:
    return await db.scalar(
        select(UserModel)
        .where(
            UserModel.restaurant_id == restaurant_id,
            UserModel.role == "owner",
        )
        .order_by(UserModel.id)
    )


async def revoke_user_sessions(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(AuthSessionModel)
        .where(
            AuthSessionModel.user_id == user_id,
            AuthSessionModel.revoked_at.is_(None),
        )
        .values(revoked_at=func.now())
    )


async def to_admin_out(
    db: AsyncSession, restaurant: RestaurantModel
) -> RestaurantAdminOut:
    owner = await owner_of_restaurant(db, restaurant.id)
    item_count = await db.scalar(
        select(func.count(MenuItemModel.id)).where(
            MenuItemModel.restaurant_id == restaurant.id
        )
    )
    category_count = await db.scalar(
        select(func.count(MenuCategoryModel.id)).where(
            MenuCategoryModel.restaurant_id == restaurant.id
        )
    )

    return RestaurantAdminOut(
        id=restaurant.id,
        slug=restaurant.slug,
        name=restaurant.name,
        label_word=restaurant.label_word or "کافه",
        about=restaurant.about_text,
        is_active=restaurant.is_active,
        owner_username=owner.username if owner else None,
        owner_is_active=bool(owner.is_active) if owner else True,
        item_count=int(item_count or 0),
        category_count=int(category_count or 0),
        logo_url=branding_image_service.get_image_url(restaurant.logo_filename),
        background_url=branding_image_service.get_image_url(
            restaurant.background_filename
        ),
        menu_path=f"/r/{restaurant.slug}",
    )


async def get_restaurant_by_id_or_404(
    db: AsyncSession, restaurant_id: int
) -> RestaurantModel:
    restaurant = await db.get(RestaurantModel, restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="کافه یافت نشد.")
    return restaurant


async def assert_username_available(
    db: AsyncSession, username: str, allow_user_id: int | None = None
) -> None:
    existing = await db.scalar(
        select(UserModel).where(func.lower(UserModel.username) == username.lower())
    )
    if existing is not None and existing.id != allow_user_id:
        raise HTTPException(
            status_code=409, detail="این نام کاربری قبلاً ثبت شده است."
        )


@app.get("/api/v1/admin/restaurants", response_model=list[RestaurantAdminOut])
async def admin_list_restaurants(
    db: AsyncSession = Depends(get_db),
    _admin: UserModel = Depends(get_current_admin),
) -> list[RestaurantAdminOut]:
    result = await db.execute(select(RestaurantModel).order_by(RestaurantModel.id))
    restaurants = result.scalars().all()
    return [await to_admin_out(db, restaurant) for restaurant in restaurants]


@app.post(
    "/api/v1/admin/restaurants",
    response_model=RestaurantAdminOut,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_restaurant(
    body: RestaurantCreate,
    db: AsyncSession = Depends(get_db),
    _admin: UserModel = Depends(get_current_admin),
) -> RestaurantAdminOut:
    await assert_username_available(db, body.owner_username)

    slug = await unique_restaurant_slug(
        db, body.slug or slugify_value(body.name)
    )
    restaurant = RestaurantModel(
        slug=slug,
        name=body.name,
        label_word=body.label_word,
        about_text=body.about,
        is_active=True,
    )
    db.add(restaurant)
    await db.flush()

    owner = UserModel(
        username=body.owner_username,
        email=placeholder_email(body.owner_username),
        password_hash=hash_password(body.owner_password),
        role="owner",
        restaurant_id=restaurant.id,
        is_owner=True,
        is_active=True,
    )
    db.add(owner)
    try:
        await db.commit()

    except IntegrityError as exc:
        await db.rollback()
        logger.warning("ساخت کافه ناموفق بود: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این نام کاربری یا نشانی کافه قبلاً ثبت شده است؛ مقدار دیگری انتخاب کنید.",
        ) from exc

    except IntegrityError:
        # تداخل محدودیت دیتابیس (مثلاً نام کاربری تکراری در لحظهٔ آخر) با
        # پیام فارسی مشخص گزارش می‌شود، نه خطای عمومی ۵۰۰.
        await db.rollback()
        logger.warning(
            "ثبت کافه با خطای محدودیت دیتابیس ناموفق بود", exc_info=True
        )
        raise HTTPException(
            status_code=409,
            detail=(
                "ثبت کافه ممکن نشد؛ نام کاربری یا نشانی تکراری است یا یکی از "
                "مقادیر فرم با محدودیت‌های ثبت هم‌خوان نیست."
            ),
        )

    await db.refresh(restaurant)

    return await to_admin_out(db, restaurant)


@app.patch(
    "/api/v1/admin/restaurants/{restaurant_id}", response_model=RestaurantAdminOut
)
async def admin_update_restaurant(
    restaurant_id: int,
    body: RestaurantAdminUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: UserModel = Depends(get_current_admin),
) -> RestaurantAdminOut:
    restaurant = await get_restaurant_by_id_or_404(db, restaurant_id)
    owner = await owner_of_restaurant(db, restaurant.id)

    if body.name is not None:
        restaurant.name = body.name
    if body.label_word is not None:
        restaurant.label_word = body.label_word
    if "about" in body.model_fields_set:
        restaurant.about_text = body.about
    if body.slug is not None and body.slug != restaurant.slug:
        restaurant.slug = await unique_restaurant_slug(
            db, body.slug, exclude_id=restaurant.id
        )

    if body.is_active is not None:
        restaurant.is_active = body.is_active
        if owner is not None:
            # کافهٔ غیرفعال یعنی صاحبش هم نتواند وارد شود و QR بی‌اعتبار شود.
            owner.is_active = body.is_active
            if not body.is_active:
                await revoke_user_sessions(db, owner.id)

    if body.owner_username is not None:
        if owner is None:
            raise HTTPException(
                status_code=400,
                detail="این کافه کاربر ندارد؛ ابتدا برای آن کاربر تعریف کنید.",
            )
        await assert_username_available(
            db, body.owner_username, allow_user_id=owner.id
        )
        owner.username = body.owner_username
        if is_placeholder_email(owner.email):
            owner.email = placeholder_email(body.owner_username)

    if body.owner_password is not None:
        if owner is None:
            raise HTTPException(
                status_code=400,
                detail="این کافه کاربر ندارد؛ ابتدا برای آن کاربر تعریف کنید.",
            )
        owner.password_hash = hash_password(body.owner_password)
        # با تغییر رمز، نشست‌های قبلی باطل می‌شوند.
        await revoke_user_sessions(db, owner.id)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.warning("ویرایش کافه ناموفق بود: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این نام کاربری یا نشانی کافه قبلاً ثبت شده است؛ مقدار دیگری انتخاب کنید.",
        ) from exc
    await db.refresh(restaurant)
    return await to_admin_out(db, restaurant)


@app.delete(
    "/api/v1/admin/restaurants/{restaurant_id}", response_model=AdminMessage
)
async def admin_delete_restaurant(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: UserModel = Depends(get_current_admin),
) -> AdminMessage:
    """حذف نرم: کافه و کاربرش غیرفعال می‌شوند تا QR و ورود بی‌اعتبار شود."""
    restaurant = await get_restaurant_by_id_or_404(db, restaurant_id)
    restaurant.is_active = False

    owner = await owner_of_restaurant(db, restaurant.id)
    if owner is not None:
        owner.is_active = False
        await revoke_user_sessions(db, owner.id)

    await db.commit()
    return AdminMessage(
        message="کافه حذف شد؛ کد QR آن دیگر کار نمی‌کند و ورود کاربر بسته شد."
    )


@app.post(
    "/api/v1/admin/restaurants/{restaurant_id}/restore",
    response_model=RestaurantAdminOut,
)
async def admin_restore_restaurant(
    restaurant_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: UserModel = Depends(get_current_admin),
) -> RestaurantAdminOut:
    restaurant = await get_restaurant_by_id_or_404(db, restaurant_id)
    restaurant.is_active = True

    owner = await owner_of_restaurant(db, restaurant.id)
    if owner is not None:
        owner.is_active = True

    await db.commit()
    await db.refresh(restaurant)
    return await to_admin_out(db, restaurant)
