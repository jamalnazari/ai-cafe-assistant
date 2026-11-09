from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Price(BaseModel):
    amount: int = Field(ge=0, description="قیمت به واحد پایهٔ ارز")
    currency: str = Field(
        pattern=r"^[A-Z]{3}$",
        description="کد سه‌حرفی ارز، مانند IRR",
    )


class MenuItem(BaseModel):
    id: str
    name: str
    category: str
    description: str
    image_url: str | None = None
    ingredients: list[str] | None = None
    # None یعنی آلرژن‌ها مشخص نیستند؛ [] یعنی بررسی شده و موردی ثبت نشده.
    allergens: list[str] | None = None
    # نام‌های جایگزین برای جست‌وجوی هوشمند؛ در پاسخ به مشتری نمایش داده نمی‌شود.
    aliases: list[str] | None = None
    is_spicy: bool | None = None
    serving_temperature: Literal["hot", "cold", "room_temperature"] | None = None
    price: Price | None = None
    is_available: bool = True


class RestaurantMenu(BaseModel):
    restaurant_slug: str
    restaurant_name: str
    # هویت بصری کافه؛ در پنل مالک قابل تغییر است.
    logo_url: str | None = None
    background_url: str | None = None
    categories: list[str] = Field(default_factory=list)
    items: list[MenuItem]


class RestaurantUpdate(BaseModel):
    """تغییر اطلاعات پایهٔ کافه توسط صاحب کافه."""

    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("نام کافه نمی‌تواند خالی باشد.")
        return name


class MenuCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("نام دسته‌بندی نمی‌تواند خالی باشد.")
        return name


class MenuItemCreate(BaseModel):
    item_key: str = Field(min_length=1, max_length=50)
    name: str
    category: str
    description: str
    price_amount: int  # قیمت به ریال (مثلا 1450000)
    ingredients: list[str] | None = None
    allergens: list[str] | None = None
    aliases: list[str] | None = None
    is_spicy: bool = False
    serving_temperature: Literal["hot", "cold", "room_temperature"] | None = None
    is_available: bool = True
    sort_order: int = Field(default=0, ge=0)


class MenuItemUpdate(BaseModel):
    """همه فیلدها اختیاری‌اند تا فیلدهای ثبت‌نشده در فرم حذف نشوند."""

    name: str | None = None
    category: str | None = None
    description: str | None = None
    price_amount: int | None = None
    ingredients: list[str] | None = None
    allergens: list[str] | None = None
    aliases: list[str] | None = None
    is_spicy: bool | None = None
    serving_temperature: Literal["hot", "cold", "room_temperature"] | None = None
    is_available: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)