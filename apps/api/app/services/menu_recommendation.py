"""تشخیص آیتم‌هایی از منو که در پاسخ دستیار به آن‌ها اشاره شده است.

این لایه به‌جای اتکا به قالب خروجی LLM، پاسخ متنی را با نام و نام‌های
جایگزین آیتم‌های منو تطبیق می‌دهد تا تصاویر پیشنهادها همیشه با دادهٔ
واقعی دیتابیس هماهنگ باشند و مدل زبانی نتواند آیتم خیالی بسازد.
"""

from __future__ import annotations

import re
import unicodedata

from app.schemas.menu import MenuItem, RestaurantMenu

ZWNJ = "\u200c"

_CHAR_MAP = str.maketrans(
    {
        "ي": "ی",
        "ك": "ک",
        "ۀ": "ه",
        "ة": "ه",
        "ؤ": "و",
        "إ": "ا",
        "أ": "ا",
        "ٱ": "ا",
        "ى": "ی",
        "آ": "ا",
        "ئ": "ی",
    }
)

_DIACRITICS = re.compile(r"[\u064B-\u065F\u0670]")
_INVISIBLE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069]")
_NON_WORD = re.compile(r"[^\w\s\u0600-\u06FF]+", re.UNICODE)
_SPACES = re.compile(r"\s+")


def normalize_menu_text(value: str) -> str:
    """یکسان‌سازی متن فارسی برای تطبیق مطمئن (ی/ك عربی، نیم‌فاصله و اعراب)."""
    text = unicodedata.normalize("NFKC", value or "")
    text = text.translate(_CHAR_MAP)
    text = text.replace(ZWNJ, " ").replace("\u200c", " ")
    text = _INVISIBLE.sub(" ", text)
    text = _DIACRITICS.sub("", text)
    text = _NON_WORD.sub(" ", text)
    return _SPACES.sub(" ", text).strip().casefold()


def _item_terms(item: MenuItem) -> list[str]:
    """نام اصلی و نام‌های جایگزین آیتم، به‌صورت نرمال‌شده و بدون تکرار."""
    terms: list[str] = []
    for raw_term in [item.name, *(item.aliases or [])]:
        normalized = normalize_menu_text(raw_term)
        if len(normalized) >= 3:
            terms.append(normalized)
    return list(dict.fromkeys(terms))


def _term_position(normalized_answer: str, term: str) -> int | None:
    pattern = re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.UNICODE)
    match = pattern.search(normalized_answer)
    return match.start() if match else None


def find_mentioned_items(
    menu: RestaurantMenu,
    answer: str,
    limit: int = 6,
) -> list[MenuItem]:
    """آیتم‌های منو را به ترتیب اولین اشاره در پاسخ برمی‌گرداند."""
    normalized_answer = normalize_menu_text(answer)
    if not normalized_answer:
        return []

    matches: list[tuple[int, int, MenuItem]] = []
    for order, item in enumerate(menu.items):
        positions = [
            position
            for term in _item_terms(item)
            if (position := _term_position(normalized_answer, term)) is not None
        ]
        if positions:
            matches.append((min(positions), order, item))

    matches.sort(key=lambda match: (match[0], match[1]))
    return [item for _, _, item in matches[: max(1, limit)]]
