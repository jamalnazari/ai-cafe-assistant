FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # لاگ‌های فارسی روی کنسول کانتینر نشکنند
    PYTHONIOENCODING=utf-8

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# کاربر غیر root برای امنیت بیشتر؛ پوشهٔ داده در volume سوار می‌شود.
RUN useradd --create-home --uid 1000 cafe \
    && mkdir -p /data/uploads/menu_items /data/uploads/branding /data/backups \
    && chown -R cafe:cafe /data /app
USER cafe

EXPOSE 8000

# پیش از بالا آمدن سرویس، جدول‌های دیتابیس تازه ساخته/به‌روز می‌شوند
# (idempotent است و روی دیتابیس موجود داده‌ای نمی‌سازد).
CMD ["sh", "-c", "python -m app.db.init_db && exec python -m uvicorn main:app --host 0.0.0.0 --port 8000"]
