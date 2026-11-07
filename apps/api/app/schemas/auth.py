from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class OwnerResponse(BaseModel):
    email: EmailStr


class LoginResponse(OwnerResponse):
    message: str
