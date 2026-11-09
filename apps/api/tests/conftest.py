import os
import tempfile
from pathlib import Path

import pytest

# پیش از import شدن اپلیکیشن، مسیر دیتابیس سراسری به یک فایل موقت تغییر می‌کند
# تا تست‌ها هرگز دیتابیس واقعی کاربر (apps/api/cafe.db) را لمس نکنند.
_TEST_DATABASE = Path(tempfile.gettempdir()) / "ai-cafe-assistant-tests.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DATABASE}"
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.rate_limit import reset_rate_limits  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limiter_state():
    """وضعیت شمارندهٔ محدودیت نرخ بین تست‌ها منتقل نشود."""
    reset_rate_limits()
    yield
    reset_rate_limits()
