"""اسکیمای پنل مدیر سامانه: مدیریت کافه‌ها و کاربران."""

import re

from pydantic import BaseModel, Field, field_validator

from app.core.config import DEFAULT_ADMIN_USERNAME
from app.core.sanitize import clean_text

USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,31}$")
SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$")

# برچسب‌های آماده؛ مقدار دلخواه هم پذیرفته می‌شود.
LABEL_SUGGESTIONS = ["کافه", "رستوران", "کافه رستوران", "کافه‌رستوران", "قهوه‌خانه"]


def normalize_slug(value: str) -> str:
    slug = value.strip().lower()
    if not SLUG_PATTERN.match(slug):
        raise ValueError(
            "نشانی کافه فقط می‌تواند شامل حروف کوچک انگلیسی، عدد و خط تیره "
            "باشد (۳ تا ۴۰ نویسه)."
        )
    if slug in {"admin", "api", "login", "dashboard", "r"}:
        raise ValueError("این نشانی رزرو شده است؛ نام دیگری انتخاب کنید.")
    return slug


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not USERNAME_PATTERN.match(username):
        raise ValueError(
            "نام کاربری باید ۳ تا ۳۲ نویسه و شامل حروف کوچک انگلیسی، عدد، "
            "نقطه، خط تیره یا زیرخط باشد."
        )
    if username == DEFAULT_ADMIN_USERNAME:
        raise ValueError("این نام کاربری رزرو شده است.")
    return username


class RestaurantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    label_word: str = Field(default="کافه", min_length=1, max_length=30)
    slug: str | None = Field(default=None, max_length=40)
    about: str | None = Field(default=None, max_length=1500)
    owner_username: str = Field(min_length=3, max_length=32)
    owner_password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        name = clean_text(value)
        if not name:
            raise ValueError("نام کافه نمی‌تواند خالی باشد.")
        return name

    @field_validator("label_word")
    @classmethod
    def _label(cls, value: str) -> str:
        return clean_text(value) or "کافه"

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return normalize_slug(value)

    @field_validator("owner_username")
    @classmethod
    def _username(cls, value: str) -> str:
        return normalize_username(value)

    @field_validator("about")
    @classmethod
    def _about(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return clean_text(value) or None


class RestaurantAdminUpdate(BaseModel):
    """همهٔ فیلدها اختیاری‌اند؛ فقط موارد ارسال‌شده تغییر می‌کنند."""

    name: str | None = Field(default=None, max_length=60)
    label_word: str | None = Field(default=None, max_length=30)
    slug: str | None = Field(default=None, max_length=40)
    about: str | None = Field(default=None, max_length=1500)
    is_active: bool | None = None
    owner_username: str | None = Field(default=None, min_length=3, max_length=32)
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = clean_text(value)
        if not name:
            raise ValueError("نام کافه نمی‌تواند خالی باشد.")
        return name

    @field_validator("label_word")
    @classmethod
    def _label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return clean_text(value) or "کافه"

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return normalize_slug(value)

    @field_validator("owner_username")
    @classmethod
    def _username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_username(value)

    @field_validator("about")
    @classmethod
    def _about(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return clean_text(value) or None


class RestaurantAdminOut(BaseModel):
    id: int
    slug: str
    name: str
    label_word: str
    about: str | None = None
    is_active: bool
    owner_username: str | None = None
    owner_is_active: bool = True
    item_count: int = 0
    category_count: int = 0
    logo_url: str | None = None
    background_url: str | None = None
    menu_path: str


class AdminMessage(BaseModel):
    message: str
    restaurant: RestaurantAdminOut | None = None
