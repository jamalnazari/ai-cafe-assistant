import pytest

from app.core.rate_limit import reset_rate_limits


@pytest.fixture(autouse=True)
def _reset_rate_limiter_state():
    """وضعیت شمارندهٔ محدودیت نرخ بین تست‌ها منتقل نشود."""
    reset_rate_limits()
    yield
    reset_rate_limits()
