# راهنمای استقرار روی سرور

این سند فرض می‌کند یک سرور لینوکسی (Ubuntu 22.04/24.04) با دسترسی `sudo` دارید و
دامنه‌ای مثل `cafe.example.com` به IP سرور وصل شده است.

---

## ۰) پیش‌نیاز سرور

```bash
sudo apt update
sudo apt install -y python3-venv nodejs npm caddy git sqlite3
node --version   # باید ۲۰ یا بالاتر باشد
python3 --version # باید ۳.۱۱ یا بالاتر باشد
```

> اگر نسخهٔ Node در مخازن توزیع قدیمی است، از `nvm` یا مخزن رسمی NodeSource نصب کنید.

---

## ۱) گرفتن کد

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone https://github.com/jamalnazari/ai-cafe-assistant.git
sudo chown -R "$USER":www-data /srv/ai-cafe-assistant
cd /srv/ai-cafe-assistant
```

---

## ۲) نصب وابستگی‌ها

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
cd ../web
npm ci
cd ../..
```

---

## ۳) تنظیمات محیطی

```bash
cd /srv/ai-cafe-assistant/apps/api
cp /srv/ai-cafe-assistant/.env.example .env
```

سپس `.env` را ویرایش کنید. حداقل تغییرات لازم:

```env
ENVIRONMENT=production
SECRET_KEY=<رشتهٔ تصادفی حداقل ۳۲ نویسه>
SESSION_COOKIE_SECURE=True
TRUST_PROXY_HEADERS=True
ALLOWED_HOSTS=cafe.example.com,localhost,127.0.0.1
DATABASE_URL=sqlite+aiosqlite:///./cafe.db
UPLOAD_DIR=/var/lib/ai-cafe-assistant/uploads/menu_items
BACKUP_DIR=/var/backups/ai-cafe-assistant
LLM_PROVIDER=openai
AI_BASE_URL=https://api.routeway.ai/v1
AI_API_KEY=<کلید شما>
LLM_MODEL=<شناسهٔ مدل>
```

سرویس Dahl هم همان قالب را دارد؛ کافی است بنویسید:

```env
LLM_PROVIDER=dahl
AI_BASE_URL=https://inference.dahl.global/v1
AI_API_KEY=<کلید داشبورد Dahl>
LLM_MODEL=zai-org/GLM-5.3-Flash
```

و اتصال را پیش از استقرار آزمایش کنید (بدون بالا آمدن کل برنامه):

```bash
cd /opt/ai-cafe-assistant
npm run check:llm
```

ساخت `SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

پوشه‌های نوشتنی:

```bash
sudo mkdir -p /var/lib/ai-cafe-assistant/uploads/menu_items /var/backups/ai-cafe-assistant
sudo chown -R www-data:www-data /var/lib/ai-cafe-assistant /var/backups/ai-cafe-assistant
```

> تنظیمات فرانت‌اند (مثل `API_INTERNAL_URL`) در `apps/web/.env.local` قرار می‌گیرد،
> نه در `.env` ریشه. مقدار پیش‌فرض `http://127.0.0.1:8000` برای همین استقرار درست است.

---

## ۴) ساخت دیتابیس و تغییر رمز مالک

```bash
cd /srv/ai-cafe-assistant
npm run db:init
npm run db:seed        # اختیاری: منوی نمونه با ۲۴ آیتم
npm run owner:password # رمز پیش‌فرض 123456 را عوض می‌کند
```

---

## ۵) بررسی تنظیمات پیش از اجرا

```bash
cd /srv/ai-cafe-assistant
ENVIRONMENT=production npm run check:prod
```

اگر `SECRET_KEY`، کلید هوش مصنوعی یا محیط درست تنظیم نشده باشد، همان‌جا با پیام
فارسی متوقف می‌شود.

---

## ۶) بیلد و اجرای موقت

```bash
npm run build
npm run start:prod
```

سپس در ترمینال دیگر:

```bash
curl -fsS http://127.0.0.1:8000/health   # {"status":"ok","database":"ok"}
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

اگر این دو پاسخ درست دادند، `Ctrl+C` بزنید و به مرحلهٔ سرویس‌ها بروید.

---

## ۷) اجرای دائمی با systemd

```bash
sudo cp deploy/cafe-api.service deploy/cafe-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cafe-api cafe-web
systemctl status cafe-api --no-pager
systemctl status cafe-web --no-pager
journalctl -u cafe-api -n 50 --no-pager
```

در فایل‌های unit مسیر `/srv/ai-cafe-assistant` و کاربر `www-data` را با سرور خودتان
هماهنگ کنید.

---

## ۸) HTTPS با Caddy

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile    # دامنه و ایمیل را عوض کنید
sudo systemctl reload caddy
```

بعد از این مرحله:

- `https://cafe.example.com` → رابط مشتری
- `https://cafe.example.com/api/v1/...` → بک‌اند (بدون عبور از Next.js)
- `https://cafe.example.com/dashboard` → پنل مالک

پورت‌های ۸۰۰۰ و ۳۰۰۰ فقط روی `127.0.0.1` باز هستند و از بیرون در دسترس نیستند.
فایروال:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

---

## ۹) پشتیبان‌گیری خودکار

فایل `/etc/cron.d/cafe-backup`:

```cron
30 2 * * * www-data cd /srv/ai-cafe-assistant/apps/api && .venv/bin/python -m app.db.backup_db >> /var/log/cafe-backup.log 2>&1
```

پشتیبان‌ها در `/var/backups/ai-cafe-assistant/cafe-YYYYMMDD-HHMMSS.db` ساخته و
بر اساس `BACKUP_KEEP` (پیش‌فرض ۱۴ نسخه) چرخش می‌شوند. برای تصاویر منو:

```cron
45 2 * * * www-data tar czf /var/backups/ai-cafe-assistant/uploads-$(date +\%Y\%m\%d).tar.gz -C /var/lib/ai-cafe-assistant uploads
```

**بازگردانی:** سرویس‌ها را متوقف کنید، فایل پشتیبان را روی `cafe.db` کپی کنید و
سرویس‌ها را دوباره بالا بیاورید.

---

## ۱۰) به‌روزرسانی نسخه

```bash
cd /srv/ai-cafe-assistant
npm run db:backup          # اول پشتیبان
git pull
cd apps/api && .venv/bin/pip install -r requirements.txt && cd ../..
cd apps/web && npm ci && cd ../..
npm run build
sudo systemctl restart cafe-api cafe-web
curl -fsS http://127.0.0.1:8000/health
```

---

## ۱۱) چک‌لیست امنیتی نهایی

- [ ] `ENVIRONMENT=production` تنظیم شده است
- [ ] `SECRET_KEY` تصادفی و حداقل ۳۲ نویسه است
- [ ] رمز مالک از `123456` تغییر کرده است (`npm run owner:password`)
- [ ] `SESSION_COOKIE_SECURE=True` و سایت روی HTTPS است
- [ ] `ALLOWED_HOSTS` دامنهٔ واقعی را دارد
- [ ] `TRUST_PROXY_HEADERS=True` (چون پشت Caddy هستیم)
- [ ] `/docs` بسته است: `curl -o /dev/null -w "%{http_code}" https://<domain>/api/docs` → `404`
- [ ] پورت‌های ۸۰۰۰ و ۳۰۰۰ از بیرون بسته‌اند
- [ ] پشتیبان روزانه تست شده و یک بار بازگردانی را امتحان کرده‌اید
- [ ] `.env` در گیت نیست (`git check-ignore apps/api/.env`)

---

## ۱۲) خارج کردن دیتابیس از گیت (توصیه‌شده)

دیتابیس محلیِ توسعه داخل مخزن ردیابی می‌شود. روی سرور این کار لازم نیست و بهتر است
داده‌های واقعی در گیت نباشند. **این کار فایل را از دیسک حذف نمی‌کند:**

```bash
git rm --cached apps/api/cafe.db
echo "apps/api/cafe.db" >> .gitignore
git commit -m "chore: stop tracking local database"
```

پیش از این کار یک نسخهٔ پشتیبان بگیرید:

```bash
cp apps/api/cafe.db ~/cafe.db.backup
```

---

## عیب‌یابی سریع

| نشانه | بررسی |
| --- | --- |
| سرویس API بالا نمی‌آید | `journalctl -u cafe-api -n 80`؛ معمولاً `SECRET_KEY` یا `AI_API_KEY` است |
| خطای ۵۰۲ از Caddy | پورت ۳۰۰۰/۸۰۰۰ گوش نمی‌دهد؛ `ss -ltnp | grep -E '3000|8000'` |
| «دستیار موقتاً در دسترس نیست» | `npm run check:llm`؛ کلید/آدرس/شناسهٔ مدل یا محدودیت سرویس‌دهنده |
| خطای ۴۲۹ برای مشتری | `ASK_RATE_LIMIT` را متناسب با ترافیک کافه تنظیم کنید |
| دیتابیس قفل می‌شود | WAL در کد فعال است؛ مطمئن شوید فایل `cafe.db-wal` قابل نوشتن است |
| تصاویر بعد از به‌روزرسانی نیستند | `UPLOAD_DIR` باید بیرون از پوشهٔ پروژه و پایدار باشد |
