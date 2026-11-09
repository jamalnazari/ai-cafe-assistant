import logging
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# پیدا کردن مسیر ریشهٔ پروژه برای خواندن فایل .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
API_DIR = Path(__file__).resolve().parents[2]

DEFAULT_SECRET_KEY = "dev-secret-key-change-in-production"
DEFAULT_OWNER_PASSWORD = "123456"

logger = logging.getLogger("cafe.config")


class Settings(BaseSettings):
    PROJECT_NAME: str = "Cafe Voice Assistant API"
    VERSION: str = "0.1.0"

    # محیط اجرا: development برای توسعهٔ محلی، production روی سرور
    ENVIRONMENT: Literal["development", "test", "production"] = "development"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./cafe.db"

    # Security
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    SESSION_COOKIE_NAME: str = "cafe_owner_session"
    SESSION_TTL_SECONDS: int = 60 * 60 * 24 * 7
    # اگر مقدار داده نشود، در production به‌صورت خودکار True می‌شود.
    SESSION_COOKIE_SECURE: bool | None = None

    # محدودیت نرخ درخواست (محافظت از هزینهٔ API و رمز مالک)
    RATE_LIMIT_ENABLED: bool = True
    ASK_RATE_LIMIT: int = 20  # تعداد پرسش مجاز
    ASK_RATE_WINDOW_SECONDS: int = 60  # در این بازهٔ زمانی
    LOGIN_RATE_LIMIT: int = 8  # تعداد تلاش ورود مجاز
    LOGIN_RATE_WINDOW_SECONDS: int = 300
    # وقتی پشت پروکسی معتبر (Caddy/Nginx) اجرا می‌شود True شود تا IP واقعی خوانده شود.
    TRUST_PROXY_HEADERS: bool = False

    # دامنه‌های مجاز؛ خالی یعنی محدودیتی اعمال نمی‌شود (مثلاً cafe.example.com,localhost)
    ALLOWED_HOSTS: str = ""

    # Menu item images
    UPLOAD_DIR: Path = API_DIR / "uploads" / "menu_items"
    # تصاویر هویت کافه (لوگو و پس‌زمینهٔ صفحهٔ مشتری)
    BRANDING_UPLOAD_DIR: Path = API_DIR / "uploads" / "branding"
    UPLOAD_MAX_BYTES: int = 5 * 1024 * 1024

    # پشتیبان‌گیری از دیتابیس
    BACKUP_DIR: Path = API_DIR / "backups"
    BACKUP_KEEP: int = 14

    # AI Providers
    STT_PROVIDER: str = "mock"
    LLM_PROVIDER: str = "mock"
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = "mock-key"
    STT_MODEL: str = "whisper-1"
    LLM_MODEL: str = "gpt-4o-mini"
    AI_REQUEST_TIMEOUT_SECONDS: float = 30.0
    AI_MAX_RETRIES: int = 2

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), str(API_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- ویژگی‌های محاسبه‌شده ---

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def docs_url(self) -> str | None:
        """مستندات تعاملی API فقط در محیط توسعه در دسترس است."""
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> str | None:
        return None if self.is_production else "/redoc"

    @property
    def openapi_url(self) -> str | None:
        return None if self.is_production else "/openapi.json"

    @property
    def session_cookie_secure(self) -> bool:
        if self.SESSION_COOKIE_SECURE is None:
            return self.is_production
        return self.SESSION_COOKIE_SECURE

    @property
    def allowed_hosts(self) -> list[str]:
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",") if host.strip()]

    # --- اعتبارسنجی راه‌اندازی ---

    def validate_startup(self) -> None:
        """
        پیش از بالا آمدن سرویس اجرا می‌شود.
        در production جلوی اجرای ناایمن گرفته می‌شود؛ در توسعه فقط هشدار می‌دهد.
        """
        problems: list[str] = []

        if self.SECRET_KEY == DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32:
            problems.append(
                "SECRET_KEY امن نیست. یک رشتهٔ تصادفی با حداقل ۳۲ نویسه تنظیم کنید."
            )

        if self.LLM_PROVIDER not in {"mock", "openai"}:
            problems.append(
                f"LLM_PROVIDER نامعتبر است: {self.LLM_PROVIDER!r} (مقادیر مجاز: mock, openai)"
            )

        if self.LLM_PROVIDER != "mock" and self.AI_API_KEY in {"", "mock-key"}:
            problems.append(
                "LLM_PROVIDER روی سرویس واقعی تنظیم شده اما AI_API_KEY پر نشده است."
            )

        if self.LLM_PROVIDER != "mock" and not self.AI_BASE_URL.startswith(("http://", "https://")):
            problems.append("AI_BASE_URL باید با http:// یا https:// شروع شود.")

        if self.is_production:
            if problems:
                raise RuntimeError(
                    "راه‌اندازی در حالت production متوقف شد:\n- " + "\n- ".join(problems)
                )
            if not self.session_cookie_secure:
                logger.warning(
                    "SESSION_COOKIE_SECURE=False در production؛ نشست مالک روی HTTP ارسال می‌شود."
                )
        else:
            for problem in problems:
                logger.warning("%s (در development فقط هشدار است)", problem)

        if self.LLM_PROVIDER == "mock":
            logger.info("LLM_PROVIDER=mock است؛ پاسخ‌های دستیار نمونه و بدون هزینه هستند.")


settings = Settings()
