import Link from "next/link";
import { Coffee, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-muted text-ink-soft">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-black">این صفحه پیدا نشد</h1>
        <p className="mt-2 text-xs leading-6 text-ink-soft">
          ممکن است نشانی اشتباه باشد یا این کافه غیرفعال شده باشد. اگر کد QR را
          اسکن کرده‌اید، از پرسنل کافه بخواهید کد جدید را در اختیارتان بگذارد.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary-strong"
        >
          <Coffee className="h-4 w-4" aria-hidden="true" />
          بازگشت به صفحهٔ اصلی
        </Link>
      </div>
    </main>
  );
}
