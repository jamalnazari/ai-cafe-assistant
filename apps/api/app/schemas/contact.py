"""اطلاعات تماس و سئوی محلی کافه.

این فیلدها هم در پنل مدیر و هم توسط صاحب کافه قابل ویرایش‌اند و مبنای ساخت
صفحهٔ عمومی، دادهٔ ساخت‌یافته (JSON-LD) و نمایش آدرس/تلفن/ساعت کاری هستند.
"""

import re

from pydantic import BaseModel, Field, field_validator

from app.core.sanitize import clean_text

PHONE_PATTERN = re.compile(r"^[0-9+\-()\s]{5,30}$")
# شناسهٔ اینستاگرام: حروف انگلیسی، عدد، نقطه و زیرخط (۱ تا ۳۰ نویسه)
INSTAGRAM_PATTERN = re.compile(r"^[A-Za-z0-9._]{1,30}$")


class FaqItem(BaseModel):
    question: str = Field(min_length=3, max_length=120)
    answer: str = Field(min_length=1, max_length=500)

    @field_validator("question", "answer")
    @classmethod
    def _clean(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("پرسش و پاسخ نباید خالی باشد.")
        return cleaned


class ContactFields(BaseModel):
    """فیلدهای اختیاری تماس و معرفی که در صفحهٔ عمومی نمایش داده می‌شوند."""

    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    # شناسهٔ اینستاگرام بدون @؛ با @ یا نشانی کامل هم وارد شود پاک‌سازی می‌شود.
    instagram: str | None = Field(default=None, max_length=80)
    opening_hours: str | None = Field(default=None, max_length=255)
    price_range: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=60)
    cuisine_tags: list[str] | None = Field(default=None, max_length=8)
    faq: list[FaqItem] | None = Field(default=None, max_length=10)

    @field_validator("address", "opening_hours", "price_range", "city")
    @classmethod
    def _clean_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return clean_text(value) or None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        phone = clean_text(value).replace(" ", "")
        if not phone:
            return None
        if not PHONE_PATTERN.match(phone):
            raise ValueError(
                "شمارهٔ تماس فقط می‌تواند شامل رقم، +، خط تیره و پرانتز باشد."
            )
        return phone

    @field_validator("instagram")
    @classmethod
    def _instagram(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = clean_text(value).replace(" ", "")
        if not text:
            return None
        # پذیرش سه شکل ورودی: @handle، handle و نشانی کامل صفحهٔ اینستاگرام
        text = re.sub(
            r"^(?:https?://)?(?:www\.)?instagram\.com/", "", text, flags=re.IGNORECASE
        ).lstrip("@").rstrip("/")
        if not INSTAGRAM_PATTERN.match(text):
            raise ValueError(
                "شناسهٔ اینستاگرام فقط می‌تواند شامل حروف انگلیسی، عدد، "
                "نقطه و زیرخط باشد (حداکثر ۳۰ نویسه)."
            )
        return text

    @field_validator("cuisine_tags")
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        tags: list[str] = []
        for raw in value:
            tag = clean_text(str(raw))[:24]
            if tag and tag not in tags:
                tags.append(tag)
        return tags or None


class PublicRestaurant(BaseModel):
    """اطلاعات عمومی کافه برای صفحهٔ هاب شهر و sitemap."""

    slug: str
    name: str
    label_word: str = "کافه"
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    opening_hours: str | None = None
    price_range: str | None = None
    about: str | None = None
    cuisine_tags: list[str] = Field(default_factory=list)
    logo_url: str | None = None
    background_url: str | None = None
    menu_path: str
    item_count: int = 0


class RestaurantProfileOut(BaseModel):
    """پاسخ ویرایش پروفایل کافه (نام، معرفی و اطلاعات تماس)."""

    message: str
    name: str
    about: str | None = None
    address: str | None = None
    phone: str | None = None
    instagram: str | None = None
    opening_hours: str | None = None
    price_range: str | None = None
    city: str | None = None
    cuisine_tags: list[str] = Field(default_factory=list)
    faq: list[FaqItem] = Field(default_factory=list)
    default_theme: str | None = None
