"""پاک‌سازی متن ورودی کاربران (لایهٔ دوم امنیت در برابر XSS)."""

import re


def clean_text(value: str) -> str:
    """تگ‌های HTML و کاراکترهای کنترلی را از متن حذف می‌کند.

    رابط کاربری (React) متن را escape می‌کند و هیچ‌جا `dangerouslySetInnerHTML`
    استفاده نشده است؛ این تابع تضمین می‌کند دادهٔ آلوده اصلاً ذخیره نشود.
    """
    without_tags = re.sub(r"<[^>]*>", " ", value)
    without_tags = without_tags.replace("<", " ").replace(">", " ")
    without_controls = "".join(
        char for char in without_tags if char == "\n" or char >= " "
    )
    return re.sub(r"[ \t]{2,}", " ", without_controls).strip()
