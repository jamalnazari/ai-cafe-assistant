"""پشتیبان‌گیری امن از دیتابیس SQLite.

استفاده:

    python -m app.db.backup_db
    python -m app.db.backup_db --dest /var/backups/cafe --keep 30

این اسکریپت از API رسمی backup خود SQLite استفاده می‌کند، بنابراین حتی در حالت
WAL هم نسخهٔ سازگار و کامل می‌سازد و به فایل اصلی دست نمی‌زند.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.config import settings


def resolve_database_path(database_url: str) -> Path:
    url = make_url(database_url)

    if not url.get_backend_name().startswith("sqlite"):
        raise SystemExit(
            "این اسکریپت فقط برای دیتابیس SQLite است. برای سایر دیتابیس‌ها از ابزار "
            "پشتیبان‌گیری خودش (مثلاً pg_dump) استفاده کنید."
        )

    if not url.database or url.database == ":memory:":
        raise SystemExit("دیتابیس در حال اجرا در حافظه است و فایلی برای پشتیبان‌گیری ندارد.")

    path = Path(url.database)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def prune_old_backups(dest_dir: Path, keep: int) -> list[Path]:
    if keep <= 0:
        return []
    backups = sorted(dest_dir.glob("cafe-*.db"), key=lambda item: item.stat().st_mtime, reverse=True)
    removed = []
    for old in backups[keep:]:
        old.unlink(missing_ok=True)
        removed.append(old)
    return removed


def backup_database(database_url: str, dest_dir: Path, keep: int) -> Path:
    source = resolve_database_path(database_url)
    if not source.exists():
        raise SystemExit(f"فایل دیتابیس پیدا نشد: {source}")

    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = dest_dir / f"cafe-{stamp}.db"

    with sqlite3.connect(str(source)) as source_connection:
        with sqlite3.connect(str(target)) as target_connection:
            source_connection.backup(target_connection)

    removed = prune_old_backups(dest_dir, keep)
    print(f"پشتیبان ساخته شد: {target}")
    for old in removed:
        print(f"پشتیبان قدیمی حذف شد: {old}")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="پشتیبان‌گیری از دیتابیس کافه‌یار (SQLite)"
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=settings.BACKUP_DIR,
        help=f"پوشهٔ مقصد پشتیبان (پیش‌فرض: {settings.BACKUP_DIR})",
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=settings.BACKUP_KEEP,
        help=f"تعداد نسخه‌های نگه‌داری‌شده (پیش‌فرض: {settings.BACKUP_KEEP})",
    )
    args = parser.parse_args(argv)

    backup_database(settings.DATABASE_URL, args.dest, args.keep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
