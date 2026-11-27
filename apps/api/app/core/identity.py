"""کمک‌کننده‌های هویت کاربران.

در دیتابیس‌های قدیمی ستون `users.email` اجباری (NOT NULL) است، در حالی که
پنل مدیر فقط نام کاربری و رمز می‌گیرد. برای سازگاری، برای این کاربران یک
نشانی جای‌نگهدار ذخیره می‌شود که هرگز به کاربر نمایش داده نمی‌شود.
"""

PLACEHOLDER_EMAIL_DOMAIN = "users.cafe.local"


def placeholder_email(username: str | None) -> str:
    """نشانی جای‌نگهدار و یکتا برای کاربری که ایمیل واقعی ندارد."""
    base = (username or "user").strip().lower() or "user"
    return f"{base}@{PLACEHOLDER_EMAIL_DOMAIN}"


def is_placeholder_email(email: str | None) -> bool:
    """آیا این نشانی ساختگی است (نباید به کاربر نمایش داده شود)؟"""
    if not email:
        return False
    return email.strip().lower().endswith("@" + PLACEHOLDER_EMAIL_DOMAIN)
