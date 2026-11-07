from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MenuItemModel(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[int] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_key: Mapped[str] = mapped_column(String(50), nullable=False)  # مثل latte
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # اطلاعات ساختاری
    ingredients: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    allergens: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    is_spicy: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    serving_temperature: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # قیمت
    price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    price_currency: Mapped[str] = mapped_column(String(3), default="IRR")
    
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # رابطه معکوس با رستوران
    restaurant: Mapped["RestaurantModel"] = relationship(
        "RestaurantModel",
        back_populates="items",
    )