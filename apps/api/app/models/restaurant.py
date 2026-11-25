from datetime import datetime, timezone
from sqlalchemy import JSON, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RestaurantModel(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # واژهٔ نمایشی قبل از نام: «کافه»، «رستوران»، «کافه‌رستوران» و …
    label_word: Mapped[str] = mapped_column(
        String(30), default="کافه", nullable=False
    )
    # تصاویر هویت کافه که صاحب کافه از پنل بارگذاری می‌کند
    logo_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    background_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    # توضیحات کلی مجموعه که صاحب کافه می‌نویسد و دستیار هوشمند از آن استفاده می‌کند
    about_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # اطلاعات تماس و سئوی محلی؛ صفحهٔ عمومی هر کافه و دادهٔ ساخت‌یافته از این‌ها
    # ساخته می‌شود تا کافه در جست‌وجوی «... در گرگان» دیده شود.
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    price_range: Mapped[str | None] = mapped_column(String(40), nullable=True)
    city: Mapped[str | None] = mapped_column(String(60), nullable=True, default="گرگان")
    # برچسب‌های آشپزی مثل «ایرانی»، «سنتی»، «کباب»
    cuisine_tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # پرسش‌های پرتکرار: [{"question": "...", "answer": "..."}]
    faq: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # تم پیش‌فرض صفحهٔ مشتری که صاحب کافه انتخاب می‌کند
    # (amber/purple/emerald/midnight)؛ خالی یعنی تم پیش‌فرض سراسری.
    default_theme: Mapped[str | None] = mapped_column(String(20), nullable=True)
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