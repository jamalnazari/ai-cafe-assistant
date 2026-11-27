from pathlib import Path
from uuid import uuid4

import anyio
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings


class MenuImageService:
    def __init__(self) -> None:
        self.upload_dir = settings.UPLOAD_DIR

    @staticmethod
    def get_image_url(filename: str | None) -> str | None:
        if not filename:
            return None
        return f"/api/v1/uploads/menu-items/{filename}"

    async def save_image(self, file: UploadFile) -> str:
        content_type = (file.content_type or "").lower()
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فرمت تصویر باید JPG، PNG یا WebP باشد.",
            )

        data = await file.read(settings.UPLOAD_MAX_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="فایل تصویر خالی است.")
        if len(data) > settings.UPLOAD_MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="حجم تصویر نباید بیشتر از ۵ مگابایت باشد.",
            )

        detected_type, extension = self._detect_image_type(data)
        if detected_type is None or detected_type != content_type:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="محتوای فایل یک تصویر معتبر JPG، PNG یا WebP نیست.",
            )

        filename = f"{uuid4().hex}{extension}"
        await anyio.to_thread.run_sync(self._write_image, filename, data)
        return filename

    def delete_image(self, filename: str | None) -> None:
        if not filename or Path(filename).name != filename:
            return
        try:
            (self.upload_dir / filename).unlink()
        except FileNotFoundError:
            pass

    def _write_image(self, filename: str, data: bytes) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / filename).write_bytes(data)

    @staticmethod
    def _detect_image_type(data: bytes) -> tuple[str | None, str]:
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png", ".png"
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg", ".jpg"
        if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return "image/webp", ".webp"
        return None, ""


menu_image_service = MenuImageService()
