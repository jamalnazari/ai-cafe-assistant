#!/usr/bin/env bash
# پشتیبان روزانه از دیتابیس و تصاویر (برای cron)
#
# نصب در cron (هر روز ساعت ۳ بامداد):
#   sudo crontab -e
#   0 3 * * * /srv/ai-cafe-assistant/deploy/backup.sh >> /var/log/cafe-backup.log 2>&1
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ai-cafe-assistant}"
DB_PATH="${DB_PATH:-$APP_DIR/apps/api/cafe.db}"
DEST="${BACKUP_DIR:-/var/backups/ai-cafe-assistant}"
KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"

if [ -f "$DB_PATH" ]; then
  # sqlite3 .backup امن است حتی وقتی سرویس در حال اجراست.
  sqlite3 "$DB_PATH" ".backup '$DEST/cafe-$STAMP.db'"
  echo "[backup] دیتابیس: $DEST/cafe-$STAMP.db"
else
  echo "[backup] دیتابیس پیدا نشد: $DB_PATH" >&2
fi

UPLOADS="${UPLOADS_DIR:-$APP_DIR/apps/api/uploads}"
if [ -d "$UPLOADS" ]; then
  tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
  echo "[backup] تصاویر: $DEST/uploads-$STAMP.tar.gz"
fi

# نگه‌داشتن N نسخهٔ آخر
ls -1t "$DEST"/cafe-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DEST"/uploads-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[backup] پایان: $(date)"
