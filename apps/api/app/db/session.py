import logging
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("cafe.db")

# ساخت موتور اتصال به دیتابیس
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # اگر True باشد، تمام دستورات SQL را در ترمینال چاپ می‌کند (برای دیباگ خوب است)
)

if settings.DATABASE_URL.startswith("sqlite"):
    # تنظیمات SQLite که برای اجرای هم‌زمان و پایدارتر روی سرور لازم است:
    # WAL اجازهٔ خواندن هم‌زمان با نوشتن می‌دهد و busy_timeout از خطای
    # "database is locked" در درخواست‌های هم‌زمان جلوگیری می‌کند.
    @event.listens_for(engine.sync_engine, "connect")
    def _apply_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

# ساخت کارخانهٔ نشست‌ها (Session Factory)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """کلاس پایه برای تمام مدل‌های ORM دیتابیس"""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency برای دریافت نشست دیتابیس در مسیرهای FastAPI"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
