from datetime import datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_session import AuthSessionModel
from app.models.user import UserModel


class SqlAlchemyAuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> UserModel | None:
        result = await self.session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> UserModel | None:
        result = await self.session.execute(
            select(UserModel).where(
                func.lower(UserModel.username) == username.strip().lower()
            )
        )
        return result.scalar_one_or_none()

    async def create_session(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> AuthSessionModel:
        auth_session = AuthSessionModel(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.session.add(auth_session)
        return auth_session

    async def get_owner_by_session_token_hash(
        self, token_hash: str
    ) -> UserModel | None:
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(UserModel)
            .join(AuthSessionModel, AuthSessionModel.user_id == UserModel.id)
            .where(
                AuthSessionModel.token_hash == token_hash,
                AuthSessionModel.revoked_at.is_(None),
                AuthSessionModel.expires_at > now,
                UserModel.is_owner.is_(True),
                UserModel.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def revoke_session(self, token_hash: str) -> None:
        await self.session.execute(
            update(AuthSessionModel)
            .where(
                AuthSessionModel.token_hash == token_hash,
                AuthSessionModel.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )

    async def delete_expired_sessions(self) -> None:
        await self.session.execute(
            delete(AuthSessionModel).where(
                AuthSessionModel.expires_at <= datetime.now(timezone.utc)
            )
        )
