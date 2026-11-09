"""تغییر رمز صاحب کافه از خط فرمان (بدون نیاز به رابط گرافیکی).

استفادهٔ تعاملی (امن‌ترین حالت، رمز در تاریخچهٔ شل ذخیره نمی‌شود):

    python -m app.db.set_owner_password

یا با تعیین ایمیل و رمز:

    python -m app.db.set_owner_password --email owner@cafe.com --password "رمز-جدید-من"
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.core.config import DEFAULT_OWNER_PASSWORD
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import UserModel

MIN_PASSWORD_LENGTH = 8


async def set_owner_password(email: str, password: str) -> int:
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"رمز باید حداقل {MIN_PASSWORD_LENGTH} نویسه باشد.", file=sys.stderr)
        return 2
    if password == DEFAULT_OWNER_PASSWORD:
        print("رمز پیش‌فرض پروژه امن نیست؛ رمز دیگری انتخاب کنید.", file=sys.stderr)
        return 2

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserModel).where(UserModel.email == email.strip().lower())
        )
        owner = result.scalar_one_or_none()
        if owner is None:
            print(f"کاربری با این ایمیل پیدا نشد: {email}", file=sys.stderr)
            return 1

        owner.password_hash = hash_password(password)
        await session.commit()

    print(f"رمز کاربر {email} با موفقیت تغییر کرد.")
    return 0


def read_password_from_prompt() -> str:
    first = getpass.getpass("رمز جدید: ")
    second = getpass.getpass("تکرار رمز جدید: ")
    if first != second:
        print("دو رمز وارد‌شده یکسان نیستند.", file=sys.stderr)
        raise SystemExit(2)
    return first


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="تغییر رمز صاحب کافه")
    parser.add_argument(
        "--email",
        default="owner@cafe.com",
        help="ایمیل صاحب کافه (پیش‌فرض: owner@cafe.com)",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="رمز جدید؛ اگر داده نشود به‌صورت تعاملی پرسیده می‌شود",
    )
    args = parser.parse_args(argv)

    password = args.password or read_password_from_prompt()
    return asyncio.run(set_owner_password(args.email, password))


if __name__ == "__main__":
    sys.exit(main())
