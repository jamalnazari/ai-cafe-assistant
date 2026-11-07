from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    generate_session_token,
    hash_session_token,
    verify_password,
)
from app.models.user import UserModel
from app.repositories.auth_repository import SqlAlchemyAuthRepository


class AuthService:
    async def authenticate_owner(
        self, db: AsyncSession, email: str, password: str
    ) -> UserModel | None:
        repo = SqlAlchemyAuthRepository(db)
        user = await repo.get_user_by_email(email.strip().lower())

        if (
            user is None
            or not user.is_owner
            or not verify_password(password, user.password_hash)
        ):
            return None

        return user

    async def create_session(
        self, db: AsyncSession, user: UserModel
    ) -> tuple[str, datetime]:
        token = generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.SESSION_TTL_SECONDS
        )
        repo = SqlAlchemyAuthRepository(db)
        await repo.delete_expired_sessions()
        await repo.create_session(
            user_id=user.id,
            token_hash=hash_session_token(token),
            expires_at=expires_at,
        )
        await db.commit()
        return token, expires_at

    async def get_owner_for_session(
        self, db: AsyncSession, token: str | None
    ) -> UserModel | None:
        if not token:
            return None

        repo = SqlAlchemyAuthRepository(db)
        return await repo.get_owner_by_session_token_hash(hash_session_token(token))

    async def revoke_session(self, db: AsyncSession, token: str | None) -> None:
        if token:
            repo = SqlAlchemyAuthRepository(db)
            await repo.revoke_session(hash_session_token(token))
            await db.commit()
