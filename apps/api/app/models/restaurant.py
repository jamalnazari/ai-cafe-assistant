from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RestaurantModel(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # رابطه با آیتم‌های منو
    items: Mapped[list["MenuItemModel"]] = relationship(
        "MenuItemModel",
        back_populates="restaurant",
        cascade="all, delete-orphan",
        order_by="MenuItemModel.sort_order, MenuItemModel.id",
    )
    categories: Mapped[list["MenuCategoryModel"]] = relationship(
        "MenuCategoryModel",
        cascade="all, delete-orphan",
        order_by="MenuCategoryModel.sort_order, MenuCategoryModel.id",
    )