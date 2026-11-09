"""بررسی تنظیمات پیش از استقرار.

اجرا با فرض production:

    ENVIRONMENT=production python -m app.core.check_config
    npm run check:prod

اگر تنظیمی ناایمن باشد با پیام فارسی خارج می‌شود؛ در غیر این صورت خلاصهٔ
تنظیمات را چاپ می‌کند.
"""

from __future__ import annotations

import sys

from app.core.config import settings


def summarize() -> list[tuple[str, str]]:
    return [
        ("محیط اجرا", settings.ENVIRONMENT),
        ("آدرس دیتابیس", settings.DATABASE_URL),
        ("مستندات API", "فعال" if settings.docs_url else "بسته"),
        ("کوکی امن (HTTPS)", "بله" if settings.session_cookie_secure else "خیر"),
        ("محدودیت نرخ", "فعال" if settings.RATE_LIMIT_ENABLED else "غیرفعال"),
        (
            "سقف پرسش",
            f"{settings.ASK_RATE_LIMIT} درخواست در {settings.ASK_RATE_WINDOW_SECONDS} ثانیه",
        ),
        (
            "سقف تلاش ورود",
            f"{settings.LOGIN_RATE_LIMIT} درخواست در {settings.LOGIN_RATE_WINDOW_SECONDS} ثانیه",
        ),
        ("پاسخ‌گویی هوش مصنوعی", settings.LLM_PROVIDER),
        ("مدل", settings.LLM_MODEL),
        ("پروکسی معتبر", "بله" if settings.TRUST_PROXY_HEADERS else "خیر"),
        (
            "میزبان‌های مجاز",
            ", ".join(settings.allowed_hosts) if settings.allowed_hosts else "(بدون محدودیت)",
        ),
        ("پوشهٔ تصاویر", str(settings.UPLOAD_DIR)),
        ("پوشهٔ پشتیبان", str(settings.BACKUP_DIR)),
    ]


def main() -> int:
    try:
        settings.validate_startup()
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 1

    print("تنظیمات برای اجرا پذیرفته شد:")
    width = max(len(name) for name, _ in summarize())
    for name, value in summarize():
        print(f"  {name.ljust(width)} : {value}")

    if not settings.is_production:
        print(
            "\nتوجه: ENVIRONMENT روی production نیست. برای بررسی نهایی استقرار، "
            "متغیر ENVIRONMENT=production را تنظیم کنید."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
