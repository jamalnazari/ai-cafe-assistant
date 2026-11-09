"""محدودیت نرخ درخواست سبک و درون‌حافظه‌ای.

هدف اصلی: جلوگیری از مصرف بی‌رویهٔ هزینهٔ سرویس هوش مصنوعی توسط مسیر عمومی
`/ask-text` و کند کردن حملهٔ حدس رمز روی `/login`.

این پیاده‌سازی برای استقرار تک‌پروسه‌ای (uvicorn با یک ورکر) مناسب است. اگر روزی
چند پروسه یا چند سرور داشتید، باید به یک ذخیره‌گاه مشترک (Redis) منتقل شود.
"""

from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request, status

from app.core.config import settings

ASK_LIMIT_MESSAGE = (
    "تعداد پرسش‌های شما بیش از حد مجاز است؛ لطفاً کمی صبر کنید و دوباره تلاش کنید."
)
LOGIN_LIMIT_MESSAGE = (
    "تعداد تلاش‌های ورود بیش از حد مجاز است؛ چند دقیقه بعد دوباره تلاش کنید."
)

_MAX_TRACKED_CLIENTS = 10_000


class SlidingWindowRateLimiter:
    """شمارندهٔ پنجرهٔ لغزان به تفکیک کلید (IP یا هر شناسهٔ دیگر)."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: int,
        message: str,
    ) -> None:
        if limit <= 0 or window_seconds <= 0:
            return

        now = time.monotonic()
        threshold = now - window_seconds

        with self._lock:
            timestamps = [moment for moment in self._hits.get(key, []) if moment > threshold]

            if len(timestamps) >= limit:
                retry_after = max(1, int(timestamps[0] + window_seconds - now) + 1)
                self._hits[key] = timestamps
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=message,
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self._hits[key] = timestamps
            self._prune_if_needed()

    def _prune_if_needed(self) -> None:
        if len(self._hits) <= _MAX_TRACKED_CLIENTS:
            return
        oldest = sorted(self._hits, key=lambda item: self._hits[item][-1])
        for key in oldest[: len(self._hits) - _MAX_TRACKED_CLIENTS]:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowRateLimiter()


def client_identifier(request: Request) -> str:
    """IP مشتری؛ اگر پشت پروکسی معتبر باشد از X-Forwarded-For خوانده می‌شود."""
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "")
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def enforce_ask_rate_limit(request: Request) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    limiter.check(
        f"ask:{client_identifier(request)}",
        limit=settings.ASK_RATE_LIMIT,
        window_seconds=settings.ASK_RATE_WINDOW_SECONDS,
        message=ASK_LIMIT_MESSAGE,
    )


def enforce_login_rate_limit(request: Request) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    limiter.check(
        f"login:{client_identifier(request)}",
        limit=settings.LOGIN_RATE_LIMIT,
        window_seconds=settings.LOGIN_RATE_WINDOW_SECONDS,
        message=LOGIN_LIMIT_MESSAGE,
    )


def reset_rate_limits() -> None:
    """برای تست‌ها و برای پاک‌سازی دستی وضعیت شمارنده‌ها."""
    limiter.reset()
