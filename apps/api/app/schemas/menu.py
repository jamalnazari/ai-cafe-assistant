from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.sanitize import clean_text


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
    # واژهٔ نمایشی («کافه»، «رستوران» و …) که صاحب کافه انتخاب می‌کند.
    restaurant_label: str = "کافه"
    # هویت بصری کافه؛ در پنل مالک قابل تغییر است.
    logo_url: str | None = None
    background_url: str | None = None
    # توضیحات کلی مجموعه که صاحب کافه در پنل وارد می‌کند.
    restaurant_about: str | None = None
    categories: list[str] = Field(default_factory=list)
    items: list[MenuItem]


MAX_ABOUT_LENGTH = 1500


class RestaurantUpdate(BaseModel):
    """تغییر اطلاعات پایهٔ کافه توسط صاحب کافه.

    هر فیلد اختیاری است؛ فقط فیلدهایی که در بدنه آمده‌اند به‌روزرسانی می‌شوند.
    برای «دربارهٔ مجموعه» مقدار خالی یعنی پاک‌کردن توضیحات.
    """

    name: str | None = Field(default=None, max_length=100)
    about: str | None = Field(default=None, max_length=MAX_ABOUT_LENGTH)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = clean_text(value)
        if not name:
            raise ValueError("نام کافه نمی‌تواند خالی باشد.")
        return name

    @field_validator("about")
    @classmethod
    def validate_about(cls, value: str | None) -> str | None:
        if value is None:
            return None
        # فاصله‌های اضافی و خط‌های خالی تکراری تمیز می‌شوند.
        lines = [
            clean_text(line) for line in value.strip().splitlines()
        ]
        cleaned = "\n".join(line for line in lines if line)
        return cleaned or None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "RestaurantUpdate":
        provided = self.model_fields_set & {"name", "about"}
        if not provided:
            raise ValueError("هیچ فیلدی برای به‌روزرسانی ارسال نشده است.")
        return self


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