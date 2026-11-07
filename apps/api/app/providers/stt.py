from typing import Protocol
import httpx
from app.core.config import settings


class STTProvider(Protocol):
    async def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        ...


class MockSTTProvider:
    """حالت تستی: بدون هزینه و بدون نیاز به API Key"""

    async def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        # در حالت تست فرض می‌کنیم مشتری درباره ساندویچ مرغ تند سؤال پرسیده
        return "آیا ساندویچ مرغ تند موجود هست و قیمت‌اش چقدره؟"


class OpenAICompatibleSTTProvider:
    """حالت واقعی: اتصال به OpenAI یا سرویس‌های ایرانی (مثل AvalAI/Metis)"""

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            files = {"file": (filename, audio_bytes, "audio/webm")}
            data = {"model": self.model, "language": "fa"}

            response = await client.post(
                f"{self.base_url}/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
            )
            response.raise_for_status()
            result = response.json()
            return result.get("text", "")


def get_stt_provider() -> STTProvider:
    if settings.STT_PROVIDER == "mock":
        return MockSTTProvider()
    return OpenAICompatibleSTTProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.STT_MODEL,
    )