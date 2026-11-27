#!/usr/bin/env bash
# پشتیبان‌گیری روزانه کافه‌یار (مسیر systemd):
#   دیتابیس با API رسمی SQLite (سازگار با WAL) + آرشیو تصاویر آپلودی
#
# نصب:
#   sudo cp deploy/backup.sh /usr/local/bin/cafe-backup
#   sudo chmod +x /usr/local/bin/cafe-backup
#   sudo crontab -e
#   0 3 * * * /usr/local/bin/cafe-backup >> /var/log/cafe-backup.log 2>&1

set -euo pipefail

PROJECT_DIR="${CAFE_PROJECT_DIR:-/srv/ai-cafe-assistant}"
API_DIR="$PROJECT_DIR/apps/api"
PYTHON="$API_DIR/.venv/bin/python"

if [ ! -x "$PYTHON" ]; then
    echo "پایتون مجازی پروژه پیدا نشد: $PYTHON" >&2
    exit 1
fi

# دیتابیس (BACKUP_DIR و BACKUP_KEEP از .env خوانده می‌شوند)
cd "$API_DIR"
"$PYTHON" -m app.db.backup_db

# تصاویر منو و هویت کافه
UPLOADS_SRC="${UPLOAD_DIR:-/var/lib/ai-cafe-assistant/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-cafe-assistant}"
if [ -d "$UPLOADS_SRC" ]; then
    mkdir -p "$BACKUP_DIR"
    tar czf "$BACKUP_DIR/uploads-$(date +%Y%m%d).tar.gz" -C "$(dirname "$UPLOADS_SRC")" "$(basename "$UPLOADS_SRC")"
    # آرشیو تصاویر قدیمی‌تر از ۳۰ روز حذف می‌شود
    find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +30 -delete
fi
