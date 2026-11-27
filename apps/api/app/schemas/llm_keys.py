"""اسکیمای مدیریت کلیدهای سرویس هوش مصنوعی در پنل مدیر سامانه."""

import re

from pydantic import BaseModel, Field, field_validator

URL_PATTERN = re.compile(r"^https?://[^\s]+$")


class LlmKeyCreate(BaseModel):
    """افزودن یک اتصال جدید (base_url + api_key + model)."""

    label: str | None = Field(default=None, max_length=60)
    base_url: str = Field(min_length=8, max_length=255)
    api_key: str = Field(min_length=8, max_length=255)
    # اگر خالی باشد، مقدار LLM_MODEL فایل .env استفاده می‌شود.
    model: str | None = Field(default=None, max_length=100)

    @field_validator("label")
    @classmethod
    def _label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("base_url")
    @classmethod
    def _base_url(cls, value: str) -> str:
        url = value.strip().rstrip("/")
        if not URL_PATTERN.match(url):
            raise ValueError("نشانی سرویس باید با http:// یا https:// شروع شود.")
        return url

    @field_validator("api_key", "model")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class LlmKeyUpdate(BaseModel):
    """ویرایش کلید؛ فقط فیلدهای ارسال‌شده تغییر می‌کنند."""

    label: str | None = Field(default=None, max_length=60)
    base_url: str | None = Field(default=None, max_length=255)
    api_key: str | None = Field(default=None, max_length=255)
    model: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None

    @field_validator("label")
    @classmethod
    def _label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("base_url")
    @classmethod
    def _base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        url = value.strip().rstrip("/")
        if not URL_PATTERN.match(url):
            raise ValueError("نشانی سرویس باید با http:// یا https:// شروع شود.")
        return url

    @field_validator("api_key", "model")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class LlmKeyOut(BaseModel):
    """نمایش کلید در پنل؛ مقدار کامل api_key هرگز برگردانده نمی‌شود."""

    id: int
    label: str | None = None
    base_url: str
    model: str | None = None
    api_key_masked: str
    is_active: bool = True


class LlmKeysListOut(BaseModel):
    keys: list[LlmKeyOut]
    racing_enabled: bool
