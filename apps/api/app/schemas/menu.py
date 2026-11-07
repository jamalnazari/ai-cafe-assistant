from typing import Literal

from pydantic import BaseModel, Field


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
    ingredients: list[str] | None = None
    # None یعنی آلرژن‌ها مشخص نیستند؛ [] یعنی بررسی شده و موردی ثبت نشده.
    allergens: list[str] | None = None
    is_spicy: bool | None = None
    serving_temperature: Literal["hot", "cold", "room_temperature"] | None = None
    price: Price | None = None
    is_available: bool = True


class RestaurantMenu(BaseModel):
    restaurant_slug: str
    restaurant_name: str
    items: list[MenuItem]

class MenuItemCreate(BaseModel):
    item_key: str
    name: str
    category: str
    description: str
    price_amount: int  # قیمت به ریال (مثلا 1450000)
    ingredients: list[str] | None = None
    allergens: list[str] | None = None
    is_spicy: bool = False
    serving_temperature: Literal["hot", "cold", "room_temperature"] | None = None
    is_available: bool = True