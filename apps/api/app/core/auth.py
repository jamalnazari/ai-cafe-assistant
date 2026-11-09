from datetime import datetime

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import UserModel
from app.services.auth_service import AuthService

auth_service = AuthService()


def set_session_cookie(
    response: Response, token: str, expires_at: datetime
) -> None:
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_TTL_SECONDS,
        expires=expires_at,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
    )


async def get_current_owner(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserModel:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    owner = await auth_service.get_owner_for_session(db, token)

    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نشست شما معتبر نیست؛ لطفاً دوباره وارد شوید.",
        )

    return owner
