from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class LlmApiKeyModel(Base):
    """کلیدهای سرویس هوش مصنوعی که مدیر سامانه در پنل مدیریت می‌کند.

    هر ردیف یک اتصال کامل است (base_url + api_key + model)؛ هنگام پرسش مشتری،
    پرسش هم‌زمان به همهٔ ردیف‌های فعال فرستاده می‌شود و نخستین پاسخ معتبر
    (سریع‌ترین کلید) به مشتری نمایش داده می‌شود.
    """

    __tablename__ = "llm_api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # برچسب دلخواه برای شناسایی کلید (مثلاً «gapgpt» یا «dahl»)
    label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # کلید غیرفعال در مسابقه شرکت نمی‌کند ولی حذف نمی‌شود.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
