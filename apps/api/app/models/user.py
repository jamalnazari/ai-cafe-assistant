from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class UserModel(Base):
    """کاربر پنل: مدیر کل (admin) یا صاحب یک کافه (owner)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # ورود با نام کاربری انجام می‌شود؛ ایمیل فقط برای سازگاری با نسخه‌های قبلی است.
    username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=True
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # admin = مدیر کل سامانه، owner = صاحب کافه
    role: Mapped[str] = mapped_column(String(20), default="owner", nullable=False)
    # کافه‌ای که این کاربر مدیریت می‌کند (برای admin خالی است)
    restaurant_id: Mapped[int | None] = mapped_column(
        ForeignKey("restaurants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_owner: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
