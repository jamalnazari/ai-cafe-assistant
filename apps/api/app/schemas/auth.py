from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    """ورود با نام کاربری (یا ایمیل برای سازگاری با نسخه‌های قبلی)."""

    username: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=1, max_length=1024)

    @model_validator(mode="after")
    def require_identifier(self) -> "LoginRequest":
        if not (self.username or "").strip() and not (self.email or "").strip():
            raise ValueError("نام کاربری و رمز عبور را وارد کنید.")
        return self

    @property
    def identifier(self) -> str:
        return (self.username or self.email or "").strip()


class OwnerResponse(BaseModel):
    username: str | None = None
    email: str | None = None
    role: str = "owner"
    restaurant_slug: str | None = None
    restaurant_name: str | None = None
    restaurant_label: str | None = None


class LoginResponse(OwnerResponse):
    message: str
