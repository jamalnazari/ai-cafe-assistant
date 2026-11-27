import asyncio
import logging
import time
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger("cafe.llm")

# خطاهایی که تلاش دوباره فایده‌ای ندارد (کلید/مدل/درخواست اشتباه است).
NON_RETRYABLE_STATUS_CODES = {400, 401, 403, 404, 422}

# سقف سراسری تماس‌های هم‌زمان خروجی LLM؛ با چند مشتری هم‌زمان، هر پرسش چند
# کلید را رقابت می‌دهد و بدون سقف، هزینه/فشار سرویس کنترل‌نشده می‌شود.
_llm_call_semaphore = asyncio.Semaphore(settings.AI_MAX_CONCURRENT_LLM_CALLS)


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
            # دمای پایین برای جلوگیری از حدس زدن و پاسخ‌های پرت
            "temperature": settings.AI_TEMPERATURE,
            "stream": False,
        }

        last_error: Exception | None = None
        attempts = self.max_retries + 1

        for attempt in range(attempts):
            try:
                return await self._request(payload)
            except httpx.HTTPStatusError as error:
                last_error = error
                if error.response.status_code in NON_RETRYABLE_STATUS_CODES:
                    if error.response.status_code in {401, 403}:
                        logger.error(
                            "کلید سرویس هوش مصنوعی پذیرفته نشد؛ AI_API_KEY را بررسی کنید."
                        )
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
        async with _llm_call_semaphore:
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
                message = result["choices"][0]["message"]
                content = message.get("content")
                if not isinstance(content, str) or not content.strip():
                    # بعضی مدل‌های استدلالی (مثل DeepSeek) پاسخ را در reasoning_content
                    # می‌گذارند و content را خالی برمی‌گردانند.
                    content = message.get("reasoning_content")
                if not isinstance(content, str) or not content.strip():
                    raise ValueError("پاسخ خالی از سرویس هوش مصنوعی")
                return content.strip()


class RacingLLMProvider:
    """پرسش را هم‌زمان به چند فراهم‌کننده می‌فرستد؛ سریع‌ترین پاسخِ معتبر برنده است.

    هر پرسش مسابقهٔ مستقل خودش را دارد (بدون وضعیت مشترک)، پس چند مشتریِ
    هم‌زمان روی هم اثر نمی‌گذارند. اگر سریع‌ترین کلید خطا بدهد (مثلاً ۴۰۱)،
    منتظر بقیه می‌مانیم تا نخستین پاسخ «معتبر» برگردد.
    """

    def __init__(self, providers: list[LLMProvider], labels: list[str] | None = None):
        self.providers = providers
        self.labels = labels or [f"provider-{index + 1}" for index in range(len(providers))]

    async def generate_response(
        self,
        system_prompt: str,
        user_question: str,
        history: list[tuple[str, str]] | None = None,
    ) -> str:
        if not self.providers:
            raise LLMUnavailableError("هیچ کلید فعالی برای سرویس هوش مصنوعی ثبت نشده است.")
        if len(self.providers) == 1:
            return await self.providers[0].generate_response(
                system_prompt, user_question, history
            )

        started = time.monotonic()
        tasks = {
            asyncio.create_task(
                provider.generate_response(system_prompt, user_question, history)
            ): self.labels[index]
            for index, provider in enumerate(self.providers)
        }
        pending = set(tasks)
        last_error: Exception | None = None

        try:
            while pending:
                done, pending = await asyncio.wait(
                    pending, return_when=asyncio.FIRST_COMPLETED
                )
                for task in done:
                    label = tasks[task]
                    try:
                        answer = task.result()
                    except asyncio.CancelledError:
                        raise
                    except Exception as error:  # noqa: BLE001 - برندهٔ شکست‌خورده؛ بقیه ادامه می‌دهند
                        last_error = error
                        logger.warning(
                            "کلید %s در مسابقهٔ پاسخ شکست خورد: %s", label, error
                        )
                        continue
                    elapsed = time.monotonic() - started
                    logger.info(
                        "پاسخ دستیار از کلید %s برنده شد (%.2fs، رقابت بین %s کلید)",
                        label,
                        elapsed,
                        len(tasks),
                    )
                    return answer
        finally:
            # لغو همهٔ رقبا؛ اعم از برنده شدن، شکست همه یا CancelledError خود پرسش
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

        raise LLMUnavailableError(
            "هیچ‌کدام از کلیدهای سرویس هوش مصنوعی پاسخ معتبری برنگرداندند."
        ) from last_error


def get_llm_provider() -> LLMProvider:
    if settings.LLM_PROVIDER == "mock":
        return MockLLMProvider()
    return OpenAICompatibleLLMProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.LLM_MODEL,
    )


def build_racing_provider(rows) -> LLMProvider:
    """ساخت فراهم‌کنندهٔ مسابقه از ردیف‌های فعال جدول llm_api_keys.

    rows: هر آیتم یک تاپل (label, base_url, api_key, model)؛ model خالی یعنی
    استفاده از LLM_MODEL فایل .env. اگر هیچ ردیفی نباشد، تنظیمات .env برمی‌گردد.
    """
    providers: list[LLMProvider] = []
    labels: list[str] = []
    for label, base_url, api_key, model in rows:
        providers.append(
            OpenAICompatibleLLMProvider(
                base_url=base_url,
                api_key=api_key,
                model=model or settings.LLM_MODEL,
            )
        )
        labels.append(label or base_url)
    if not providers:
        return get_llm_provider()
    if len(providers) == 1:
        return providers[0]
    return RacingLLMProvider(providers, labels)
