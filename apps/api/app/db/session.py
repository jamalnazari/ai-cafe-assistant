from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ساخت موتور اتصال به دیتابیس
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # اگر True باشد، تمام دستورات SQL را در ترمینال چاپ می‌کند (برای دیباگ خوب است)
)

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