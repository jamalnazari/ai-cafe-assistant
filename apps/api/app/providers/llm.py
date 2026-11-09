import asyncio
import logging
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger("cafe.llm")

# خطاهایی که تلاش دوباره فایده‌ای ندارد (کلید/مدل/درخواست اشتباه است).
NON_RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 422}


class LLMUnavailableError(RuntimeError):
    """سرویس هوش مصنوعی در دسترس نیست یا پاسخ معتبری برنگرداند."""


class LLMProvider(Protocol):
    async def generate_response(
        self,
        system_prompt: str,
        user_question: str,
        history: list[tuple[str, str]] | None = None,
    ) -> str:
        ...


class MockLLMProvider:
    """حالت تستی: پاسخ‌های شبیه‌سازی‌شده بدون نیاز به API Key"""

    async def generate_response(
        self,
        system_prompt: str,
        user_question: str,
        history: list[tuple[str, str]] | None = None,
    ) -> str:
        if "قیمت" in user_question or "تند" in user_question:
            return "بله، ساندویچ مرغ تند موجود است. قیمت آن ۲۸۰,۰۰۰ تومان می‌باشد و طعم تندی دارد."
        return "سلام! من دستیار کافه هستم. چطور می‌توانم در مورد منو به شما کمک کنم؟"


class OpenAICompatibleLLMProvider:
    """حالت واقعی: اتصال به هر سرویس سازگار با OpenAI Chat Completions"""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        *,
        timeout_seconds: float | None = None,
        max_retries: int | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = (
            settings.AI_REQUEST_TIMEOUT_SECONDS
            if timeout_seconds is None
            else timeout_seconds
        )
        self.max_retries = settings.AI_MAX_RETRIES if max_retries is None else max_retries

    async def generate_response(
        self,
        system_prompt: str,
        user_question: str,
        history: list[tuple[str, str]] | None = None,
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        for previous_question, previous_answer in history or []:
            messages.extend(
                [
                    {"role": "user", "content": previous_question},
                    {"role": "assistant", "content": previous_answer},
                ]
            )
        messages.append({"role": "user", "content": user_question})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,  # دمای پایین برای جلوگیری از حدس زدن و پاسخ‌های پرت
        }

        last_error: Exception | None = None
        attempts = self.max_retries + 1

        for attempt in range(attempts):
            try:
                return await self._request(payload)
            except httpx.HTTPStatusError as error:
                last_error = error
                if error.response.status_code in NON_RETRYABLE_STATUS_CODES:
                    logger.error(
                        "سرویس هوش مصنوعی درخواست را رد کرد (%s): %s",
                        error.response.status_code,
                        error.response.text[:300],
                    )
                    break
                logger.warning(
                    "تلاش %s از %s برای تماس با سرویس هوش مصنوعی ناموفق بود: %s",
                    attempt + 1,
                    attempts,
                    error,
                )
            except (httpx.TimeoutException, httpx.TransportError) as error:
                last_error = error
                logger.warning(
                    "تلاش %s از %s برای تماس با سرویس هوش مصنوعی ناموفق بود: %s",
                    attempt + 1,
                    attempts,
                    error,
                )
            except (KeyError, IndexError, TypeError, ValueError) as error:
                # پاسخ ساختار مورد انتظار را ندارد؛ تلاش دوباره معمولاً کمکی نمی‌کند.
                last_error = error
                logger.error("پاسخ سرویس هوش مصنوعی قابل تجزیه نبود: %s", error)
                break

            if attempt < attempts - 1:
                await asyncio.sleep(0.5 * (2**attempt))

        raise LLMUnavailableError(
            "سرویس هوش مصنوعی در دسترس نیست."
        ) from last_error

    async def _request(self, payload: dict) -> str:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("پاسخ خالی از سرویس هوش مصنوعی")
            return content.strip()


def get_llm_provider() -> LLMProvider:
    if settings.LLM_PROVIDER == "mock":
        return MockLLMProvider()
    return OpenAICompatibleLLMProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.LLM_MODEL,
    )
