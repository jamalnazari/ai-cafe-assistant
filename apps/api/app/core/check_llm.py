"""بررسی اتصال به سرویس هوش مصنوعی (هر سرویس سازگار با OpenAI).

استفاده:

    npm run check:llm
    npm run check:llm -- --question "سلام، یک جمله معرفی کن"

این ابزار یک پیام کوتاه به مدل می‌فرستد و اگر کلید، مدل یا آدرس اشتباه باشد
با پیام فارسی راهنما خارج می‌شود؛ بدون اینکه لازم باشد کل برنامه بالا بیاید.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import httpx

from app.core.config import settings
from app.providers.llm import LLMUnavailableError, OpenAICompatibleLLMProvider

DEFAULT_QUESTION = "سلام! در یک جمله بگو اتصال برقرار است."
SYSTEM_PROMPT = (
    "تو یک دستیار آزمایشی هستی. فقط یک پاسخ کوتاه فارسی بده و از خودت "
    "اطلاعات اضافه نساز."
)


def mask(key: str) -> str:
    """کلید API را برای نمایش امن کوتاه می‌کند."""
    if not key:
        return "(خالی)"
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}…{key[-2:]}"


def provider_hint(error: LLMUnavailableError) -> str:
    """پیام راهنمای فارسی بر اساس خطای واقعی سرویس."""
    cause = error.__cause__

    if isinstance(cause, httpx.HTTPStatusError):
        status = cause.response.status_code
        detail = cause.response.text[:200]
        if status in {401, 403}:
            return (
                "کلید API پذیرفته نشد. مقدار AI_API_KEY را در فایل .env بررسی کنید "
                f"(کد {status})."
            )
        if status == 404:
            return (
                "آدرس یا نام مدل پیدا نشد. AI_BASE_URL باید مثل "
                "https://inference.dahl.global/v1 باشد و LLM_MODEL دقیقاً همان "
                f"شناسهٔ مدل سرویس (کد {status}). جزئیات: {detail}"
            )
        if status == 429:
            return "سهمیه یا محدودیت نرخ سرویس پر شده است؛ کمی بعد امتحان کنید (کد 429)."
        if status >= 500:
            return f"سرویس هوش مصنوعی خطای داخلی داد (کد {status}). دوباره امتحان کنید."
        return f"سرویس درخواست را رد کرد (کد {status}): {detail}"

    if isinstance(cause, httpx.TimeoutException):
        return (
            "زمان پاسخ سرویس تمام شد. اتصال اینترنت یا مقدار "
            "AI_REQUEST_TIMEOUT_SECONDS را بررسی کنید."
        )

    if isinstance(cause, httpx.TransportError):
        return (
            "اتصال به سرویس برقرار نشد. آدرس AI_BASE_URL و دسترسی اینترنت/فایروال "
            "را بررسی کنید."
        )

    if isinstance(cause, ValueError):
        return "پاسخ سرویس ساختار مورد انتظار را نداشت. نام مدل را بررسی کنید."

    return "سرویس هوش مصنوعی پاسخ معتبری نداد."


async def run(question: str) -> int:
    print("بررسی سرویس هوش مصنوعی:")
    print(f"  سرویس        : {settings.LLM_PROVIDER}")
    print(f"  آدرس         : {settings.AI_BASE_URL}")
    print(f"  مدل          : {settings.LLM_MODEL}")
    print(f"  کلید API     : {mask(settings.AI_API_KEY)}")

    if settings.LLM_PROVIDER == "mock":
        print(
            "\nLLM_PROVIDER روی mock است؛ برای استفاده از سرویس واقعی در .env "
            "مقدار LLM_PROVIDER=openai و AI_BASE_URL/AI_API_KEY/LLM_MODEL را "
            "تنظیم کنید.",
            file=sys.stderr,
        )
        return 1

    provider = OpenAICompatibleLLMProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.LLM_MODEL,
    )

    try:
        answer = await provider.generate_response(SYSTEM_PROMPT, question)
    except LLMUnavailableError as error:
        print(f"\nاتصال برقرار نشد: {provider_hint(error)}", file=sys.stderr)
        return 1

    print("\nاتصال برقرار است ✔")
    print(f"پاسخ مدل: {answer}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="بررسی اتصال به سرویس هوش مصنوعی سازگار با OpenAI"
    )
    parser.add_argument(
        "--question",
        default=DEFAULT_QUESTION,
        help="پرسشی که برای آزمایش به مدل فرستاده می‌شود",
    )
    args = parser.parse_args()
    return asyncio.run(run(args.question))


if __name__ == "__main__":
    sys.exit(main())
