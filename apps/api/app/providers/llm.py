from typing import Protocol
import httpx
from app.core.config import settings


class LLMProvider(Protocol):
    async def generate_response(self, system_prompt: str, user_question: str) -> str:
        ...


class MockLLMProvider:
    """حالت تستی: پاسخ‌های شبیه‌سازی‌شده بدون نیاز به API Key"""

    async def generate_response(self, system_prompt: str, user_question: str) -> str:
        if "قیمت" in user_question or "تند" in user_question:
            return "بله، ساندویچ مرغ تند موجود است. قیمت آن ۲۸۰,۰۰۰ تومان می‌باشد و طعم تندی دارد."
        return "سلام! من دستیار کافه هستم. چطور می‌توانم در مورد منو به شما کمک کنم؟"


class OpenAICompatibleLLMProvider:
    """حالت واقعی: استفاده از GPT-4o-mini یا مدل‌های مشابه"""

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def generate_response(self, system_prompt: str, user_question: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_question},
                ],
                "temperature": 0.2,  # دمای پایین برای جلوگیری از حدس زدن و پاسخ‌های پرت
            }

            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()


def get_llm_provider() -> LLMProvider:
    if settings.LLM_PROVIDER == "mock":
        return MockLLMProvider()
    return OpenAICompatibleLLMProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.LLM_MODEL,
    )