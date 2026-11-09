"""مدیریت تصاویر هویت کافه: لوگو و تصویر پس‌زمینهٔ صفحهٔ مشتری."""

from pathlib import Path

from app.core.config import settings
from app.services.menu_image_service import MenuImageService

# تصاویر نمونه که همراه پروژه توزیع می‌شوند (برای دمو و تست).
SAMPLE_BRANDING_DIR = Path(__file__).resolve().parents[1] / "data" / "branding"
SAMPLE_LOGO_FILE = "sample-logo.png"
SAMPLE_BACKGROUND_FILE = "sample-background.jpg"


class BrandingImageService(MenuImageService):
    """همان اعتبارسنجی و ذخیره‌سازی تصویر آیتم‌ها، در پوشهٔ جداگانهٔ برندینگ."""

    def __init__(self) -> None:
        self.upload_dir = settings.BRANDING_UPLOAD_DIR

    @staticmethod
    def get_image_url(filename: str | None) -> str | None:
        if not filename:
            return None
        return f"/api/v1/uploads/branding/{filename}"

    def install_sample(self, sample_filename: str) -> str | None:
        """
        تصویر نمونه را در پوشهٔ پشتیبان کپی می‌کند و نام فایل مقصد را برمی‌گرداند.
        اگر فایل نمونه موجود نباشد، None برمی‌گردد تا راه‌اندازی متوقف نشود.
        """
        source = SAMPLE_BRANDING_DIR / sample_filename
        if not source.exists():
            return None

        target_name = sample_filename
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / target_name).write_bytes(source.read_bytes())
        return target_name


branding_image_service = BrandingImageService()
