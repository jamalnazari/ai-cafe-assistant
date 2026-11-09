"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Coffee,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import ThemeSwitcher from "@/components/theme-switcher";

const highlights = [
  {
    icon: QrCode,
    title: "منوی دیجیتال با QR",
    description: "منوی همیشه به‌روز، آمادهٔ اسکن روی میز مشتری.",
  },
  {
    icon: Sparkles,
    title: "دستیار پاسخ‌گو",
    description: "پاسخ دقیق به سؤال‌های مشتری بر اساس منوی خودتان.",
  },
  {
    icon: ShieldCheck,
    title: "کنترل کامل دسته‌ها",
    description: "ساخت، ویرایش و حذف دسته‌بندی و آیتم‌ها در چند ثانیه.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setError(data?.detail ?? "ورود ناموفق بود؛ لطفاً دوباره تلاش کنید.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <ThemeSwitcher />
      </div>

      {/* پنل معرفی */}
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(150deg,var(--hero-from),var(--hero-to))] p-10 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-10 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -left-8 top-20 h-40 w-40 rounded-full border border-white/10" />
          <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-10 top-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/25 bg-white/10 backdrop-blur">
              <Coffee className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-black">کافه‌یار</span>
          </Link>

          <h1 className="mt-14 max-w-sm text-balance text-3xl font-black leading-[1.5]">
            پنل صاحب کافه؛ ساده، سریع و همیشه در دسترس
          </h1>
          <p className="mt-4 max-w-sm text-xs leading-6 text-white/70">
            دسته‌بندی‌ها را مدیریت کنید، آیتم‌های منو را با تصویر و قیمت اضافه
            کنید و تغییرات را همان لحظه در منوی مشتری ببینید.
          </p>
        </div>

        <ul className="relative mt-10 space-y-3">
          {highlights.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-bold">{item.title}</span>
                <span className="mt-1 block text-[10px] leading-5 text-white/60">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* فرم ورود */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
              <Coffee className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black">کافه‌یار</p>
              <p className="text-[10px] text-ink-faint">دستیار هوشمند منوی کافه</p>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 shadow-float sm:p-7">
            <div className="space-y-1.5">
              <h2 className="text-lg font-black">ورود مدیریت کافه</h2>
              <p className="text-xs leading-5 text-ink-soft">
                برای ویرایش منو و دریافت کد QR، وارد حساب صاحب کافه شوید.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[11px] font-bold text-ink-soft"
                >
                  ایمیل مدیر
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="owner@cafe.com"
                    autoComplete="username"
                    maxLength={255}
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 pl-10 text-left text-xs text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <Mail
                    className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] font-bold text-ink-soft"
                >
                  رمز عبور
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••"
                    autoComplete="current-password"
                    maxLength={1024}
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-line bg-surface-muted px-10 py-3 text-left text-xs text-ink outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <Lock
                    className="absolute left-3 top-3.5 h-4 w-4 text-ink-faint"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "پنهان‌کردن رمز عبور" : "نمایش رمز عبور"
                    }
                    className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[11px] font-bold text-danger"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    در حال بررسی...
                  </>
                ) : (
                  <>
                    ورود به پنل مدیریت
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>

          <Link
            href="/"
            className="mt-5 flex w-full items-center justify-center gap-1.5 text-[11px] font-bold text-ink-faint transition-colors hover:text-primary"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            بازگشت به صفحه اصلی
          </Link>
        </div>
      </main>
    </div>
  );
}
