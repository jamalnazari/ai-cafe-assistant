import Link from "next/link";
import {
  ArrowLeft,
  ChefHat,
  Coffee,
  MessageCircle,
  QrCode,
  Sparkles,
} from "lucide-react";

import ThemeSwitcher from "@/components/theme-switcher";

const features = [
  {
    icon: QrCode,
    title: "منو روی میز با یک اسکن",
    description:
      "QR اختصاصی کافه را پرینت کنید؛ مشتری بدون نصب اپلیکیشن منوی به‌روز را می‌بیند.",
  },
  {
    icon: MessageCircle,
    title: "دستیار پاسخ‌گو",
    description:
      "سؤال دربارهٔ ترکیبات، قیمت، تندی و آلرژن‌ها؛ پاسخ فقط بر اساس منوی خودتان.",
  },
  {
    icon: ChefHat,
    title: "پنل مدیریت ساده",
    description:
      "دسته‌بندی بسازید یا حذف کنید، آیتم و تصویر اضافه کنید و همه‌چیز را همان لحظه ببینید.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-primary-soft blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
            <Coffee className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-black tracking-tight">کافه‌یار</span>
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16">
        <section className="grid items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-bold text-ink-soft shadow-sm">
              <Sparkles
                className="h-3.5 w-3.5 text-primary"
                aria-hidden="true"
              />
              منوی دیجیتال + دستیار هوشمند
            </span>
            <h1 className="mt-5 text-balance text-3xl font-black leading-[1.4] sm:text-4xl lg:text-5xl lg:leading-[1.3]">
              منوی کافه‌ات را <span className="text-primary">هوشمند</span> کن
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-ink-soft">
              مشتری QR روی میز را اسکن می‌کند، منو را مرور می‌کند و هر سؤالی
              دربارهٔ ترکیبات، قیمت یا آلرژن‌ها از دستیار می‌پرسد. شما هم
              دسته‌بندی‌ها، آیتم‌ها و تصاویر را از پنل مدیریت خودتان کنترل
              می‌کنید.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-on-primary shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-xl active:scale-[0.99]"
              >
                ورود به پنل مدیریت
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/r/demo"
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 text-xs font-bold text-ink transition-colors hover:border-primary/40 hover:text-primary"
              >
                مشاهده منوی نمونه
              </Link>
            </div>

            <dl className="mt-9 grid max-w-md grid-cols-3 gap-2.5">
              {[
                ["۳", "آیتم نمونه"],
                ["۴", "دسته‌بندی"],
                ["۲۴/۷", "دستیار فعال"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-line/70 bg-surface/70 px-3 py-3 text-center backdrop-blur"
                >
                  <dt className="text-lg font-black text-primary">{value}</dt>
                  <dd className="mt-0.5 text-[10px] font-bold text-ink-faint">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-sm animate-rise [animation-delay:120ms]">
            <div className="mx-auto w-full rotate-2 rounded-[2rem] border border-line bg-surface p-2.5 shadow-float transition-transform hover:rotate-0">
              <div className="overflow-hidden rounded-[1.5rem] border border-line/60">
                <div className="relative overflow-hidden bg-[linear-gradient(150deg,var(--hero-from),var(--hero-to))] px-4 pb-5 pt-4 text-white">
                  <div
                    className="absolute -left-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl"
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold">
                      منوی هوشمند
                    </span>
                    <span className="h-7 w-7 rounded-xl border border-white/20 bg-white/10" />
                  </div>
                  <p className="mt-4 text-lg font-black">کافهٔ آزمایشی</p>
                  <p className="mt-0.5 text-[10px] text-white/70">
                    ۳ آیتم در ۴ دسته‌بندی
                  </p>
                </div>
                <div className="flex items-center gap-1.5 border-b border-line/60 bg-surface px-3 py-2">
                  <span className="rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold text-on-primary">
                    همه موارد
                  </span>
                  {["نوشیدنی گرم", "غذای گرم", "دسر"].map((label) => (
                    <span
                      key={label}
                      className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[9px] font-bold text-ink-soft"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="space-y-2 bg-canvas/40 p-3">
                  {[
                    ["لاته", "۱۴۵٬۰۰۰"],
                    ["لیموناد", "۹۵٬۰۰۰"],
                    ["ساندویچ مرغ تند", "۲۸۰٬۰۰۰"],
                  ].map(([name, price], index) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface p-2"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
                        aria-hidden="true"
                      >
                        {index === 1 ? (
                          <span className="text-[10px] font-black">🍋</span>
                        ) : (
                          <Coffee className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold">{name}</p>
                        <p className="truncate text-[8px] text-ink-faint">
                          آمادهٔ سرو در چند دقیقه
                        </p>
                      </div>
                      <span className="text-[9px] font-black text-primary">
                        {price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-2 w-52 rounded-2xl border border-line bg-surface p-3 shadow-float sm:-left-6">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-on-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <p className="text-[10px] font-bold">دستیار منو</p>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-ink-soft">
                «لاته شیر دارد؟» — بله، لاته با اسپرسو و شیر بخار داده‌شده آماده
                می‌شود.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-3xl border border-line bg-surface/80 p-5 shadow-card backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-black">{feature.title}</h2>
              <p className="mt-2 text-xs leading-6 text-ink-soft">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-line/70 bg-surface/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-[10px] text-ink-faint sm:flex-row">
          <p>کافه‌یار · دستیار هوشمند منوی کافه</p>
          <p dir="ltr">Next.js · FastAPI</p>
        </div>
      </footer>
    </div>
  );
}
