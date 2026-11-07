from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# پیدا کردن مسیر ریشهٔ پروژه برای خواندن فایل .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "Cafe Voice Assistant API"
    VERSION: str = "0.1.0"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./cafe.db"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    SESSION_COOKIE_NAME: str = "cafe_owner_session"
    SESSION_TTL_SECONDS: int = 60 * 60 * 24 * 7
    # برای اجرای محلی روی HTTP خاموش است؛ در production حتماً True شود.
    SESSION_COOKIE_SECURE: bool = False

    # AI Providers
    STT_PROVIDER: str = "mock"
    LLM_PROVIDER: str = "mock"
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = "mock-key"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()       