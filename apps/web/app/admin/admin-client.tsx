"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CircleAlert,
  Coffee,
  Copy,
  ExternalLink,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Power,
  Printer,
  QrCode,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import Modal from "@/components/ui/modal";
import ThemeSwitcher from "@/components/theme-switcher";
import { ToastViewport, useToasts } from "@/components/ui/toast";
// خوانندهٔ خطاهای API با ترجمهٔ فارسی پیام‌های اعتبارسنجی.
import { readApiError as getError } from "@/lib/api-errors";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

import { LABEL_SUGGESTIONS, type AdminRestaurant } from "./types";

type AdminClientProps = {
  initialRestaurants: AdminRestaurant[];
  baseUrl: string;
  adminUsername: string;
};

type CafeForm = {
  name: string;
  label_word: string;
  slug: string;
  about: string;
  owner_username: string;
  owner_password: string;
};

const EMPTY_FORM: CafeForm = {
  name: "",
  label_word: "کافه",
  slug: "",
  about: "",
  owner_username: "",
  owner_password: "",
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

function validateOwnerUsername(value: string): string | null {
  if (!value.trim()) return "نام کاربری صاحب کافه را وارد کنید.";
  if (!USERNAME_PATTERN.test(value.trim())) {
    return "نام کاربری باید ۳ تا ۳۲ نویسه و فقط شامل حروف کوچک انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد و با حرف یا عدد شروع شود.";
  }
  return null;
}

export default function AdminClient({
  initialRestaurants,
  baseUrl,
  adminUsername,
}: AdminClientProps) {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  const [restaurants, setRestaurants] =
    useState<AdminRestaurant[]>(initialRestaurants);
  const [loadingList, setLoadingList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminRestaurant | null>(null);
  const [form, setForm] = useState<CafeForm>(EMPTY_FORM);

  const [qrCafe, setQrCafe] = useState<AdminRestaurant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRestaurant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const stats = useMemo(
    () => ({
      total: restaurants.length,
      active: restaurants.filter((cafe) => cafe.is_active).length,
      items: restaurants.reduce((sum, cafe) => sum + cafe.item_count, 0),
      owners: restaurants.filter((cafe) => cafe.owner_username).length,
    }),
    [restaurants],
  );

  const refresh = async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/v1/admin/restaurants", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(await getError(response, "دریافت فهرست کافه‌ها ناموفق بود."));
      }
      setRestaurants((await response.json()) as AdminRestaurant[]);
    } catch (error) {
      push(error instanceof Error ? error.message : "خطا در دریافت فهرست", "error");
    } finally {
      setLoadingList(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (cafe: AdminRestaurant) => {
    setForm({
      name: cafe.name,
      label_word: cafe.label_word,
      slug: cafe.slug,
      about: cafe.about ?? "",
      owner_username: cafe.owner_username ?? "",
      owner_password: "",
    });
    setFormError(null);
    setEditing(cafe);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const usernameError = validateOwnerUsername(form.owner_username);
    if (usernameError) {
      setFormError(usernameError);
      return;
    }
    if (form.owner_password.length < 8) {
      setFormError("رمز عبور صاحب کافه باید حداقل ۸ نویسه باشد.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/v1/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name,
          label_word: form.label_word,
          slug: form.slug.trim() || null,
          about: form.about.trim() || null,
          owner_username: form.owner_username,
          owner_password: form.owner_password,
        }),
      });
      if (!response.ok) {
        throw new Error(await getError(response, "ساخت کافه ناموفق بود."));
      }
      const created = (await response.json()) as AdminRestaurant;
      setRestaurants((current) => [...current, created]);
      setShowCreate(false);
      push("کافه ساخته شد؛ کد QR آن آماده است.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "ساخت کافه ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    const usernameError = form.owner_username
      ? validateOwnerUsername(form.owner_username)
      : null;
    if (usernameError) {
      setFormError(usernameError);
      return;
    }
    if (form.owner_password && form.owner_password.length < 8) {
      setFormError("رمز عبور جدید باید حداقل ۸ نویسه باشد.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        label_word: form.label_word,
        slug: form.slug.trim() || null,
        about: form.about.trim(),
      };
      if (form.owner_username && form.owner_username !== editing.owner_username) {
        body.owner_username = form.owner_username;
      }
      if (form.owner_password) {
        body.owner_password = form.owner_password;
      }

      const response = await fetch(
        `/api/v1/admin/restaurants/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await getError(response, "ذخیرهٔ تغییرات ناموفق بود."));
      }
      const updated = (await response.json()) as AdminRestaurant;
      setRestaurants((current) =>
        current.map((cafe) => (cafe.id === updated.id ? updated : cafe)),
      );
      setEditing(null);
      push("تغییرات کافه ذخیره شد.");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "ذخیرهٔ تغییرات ناموفق بود.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cafe: AdminRestaurant) => {
    setBusyId(cafe.id);
    try {
      const response = await fetch(
        cafe.is_active
          ? `/api/v1/admin/restaurants/${cafe.id}`
          : `/api/v1/admin/restaurants/${cafe.id}/restore`,
        {
          method: cafe.is_active ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: cafe.is_active ? JSON.stringify({ is_active: false }) : undefined,
        },
      );
      if (!response.ok) {
        throw new Error(await getError(response, "تغییر وضعیت ناموفق بود."));
      }
      await refresh();
      push(
        cafe.is_active
          ? "کافه غیرفعال شد؛ QR و ورود صاحب آن کار نمی‌کند."
          : "کافه دوباره فعال شد.",
      );
    } catch (error) {
      push(error instanceof Error ? error.message : "تغییر وضعیت ناموفق بود", "error");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/v1/admin/restaurants/${deleteTarget.id}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!response.ok) {
        throw new Error(await getError(response, "حذف کافه ناموفق بود."));
      }
      setRestaurants((current) =>
        current.map((cafe) =>
          cafe.id === deleteTarget.id
            ? { ...cafe, is_active: false, owner_is_active: false }
            : cafe,
        ),
      );
      setDeleteTarget(null);
      push("کافه حذف شد و کد QR آن دیگر معتبر نیست.");
    } catch (error) {
      push(error instanceof Error ? error.message : "حذف کافه ناموفق بود.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = async (cafe: AdminRestaurant) => {
    try {
      await navigator.clipboard.writeText(`${baseUrl}${cafe.menu_path}`);
      push("لینک منو کپی شد.");
    } catch {
      push("کپی لینک ممکن نشد.", "error");
    }
  };

  const logout = async () => {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  const formFields = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="cafe-name" className="text-[10px] font-bold text-ink-soft">
            نام کافه / رستوران
          </label>
          <input
            id="cafe-name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            maxLength={60}
            required
            placeholder="تراس"
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cafe-label" className="text-[10px] font-bold text-ink-soft">
            واژهٔ نمایشی
          </label>
          <input
            id="cafe-label"
            list="label-suggestions"
            value={form.label_word}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                label_word: event.target.value,
              }))
            }
            maxLength={30}
            required
            placeholder="کافه / رستوران / کافه رستوران"
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <datalist id="label-suggestions">
            {LABEL_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cafe-slug" className="text-[10px] font-bold text-ink-soft">
          نشانی منو (اختیاری)
        </label>
        <input
          id="cafe-slug"
          value={form.slug}
          onChange={(event) =>
            setForm((current) => ({ ...current, slug: event.target.value }))
          }
          dir="ltr"
          maxLength={40}
          placeholder="teras"
          className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-left text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        <p className="text-[10px] text-ink-faint">
          خالی بگذارید تا خودکار ساخته شود. لینک QR:{" "}
          <span dir="ltr">/r/{form.slug || "…"}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="owner-username" className="text-[10px] font-bold text-ink-soft">
            نام کاربری صاحب کافه
          </label>
          <input
            id="owner-username"
            value={form.owner_username}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                owner_username: event.target.value,
              }))
            }
            dir="ltr"
            maxLength={32}
            required
            pattern="[a-z0-9][a-z0-9_.\-]{2,31}"
            title="حروف کوچک انگلیسی، عدد، نقطه، خط تیره یا زیرخط"
            placeholder="teras_owner"
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-left text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <p className="text-[10px] text-ink-faint">
            ۳ تا ۳۲ نویسه؛ حروف کوچک انگلیسی، عدد، نقطه، خط تیره یا زیرخط.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="owner-password" className="text-[10px] font-bold text-ink-soft">
            رمز عبور {editing ? "(برای تغییر)" : ""}
          </label>
          <input
            id="owner-password"
            type="password"
            value={form.owner_password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                owner_password: event.target.value,
              }))
            }
            dir="ltr"
            minLength={8}
            maxLength={128}
            required={!editing}
            placeholder={editing ? "خالی = بدون تغییر" : "حداقل ۸ نویسه"}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-left text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cafe-about" className="text-[10px] font-bold text-ink-soft">
          دربارهٔ مجموعه (اختیاری)
        </label>
        <textarea
          id="cafe-about"
          value={form.about}
          onChange={(event) =>
            setForm((current) => ({ ...current, about: event.target.value }))
          }
          rows={3}
          maxLength={1500}
          placeholder="ساعت کاری، آدرس، امکانات…"
          className="w-full resize-y rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[11px] leading-6 text-ink outline-none placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[10px] font-bold text-danger"
        >
          {formError}
        </p>
      )}
    </>
  );

  return (
    <div className="min-h-screen overflow-x-clip pb-16">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black">پنل مدیریت سامانه</h1>
              <p className="hidden truncate text-[10px] text-ink-faint sm:block">
                {adminUsername ? `مدیر: ${adminUsername}` : "مدیر سامانه"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={logout}
              aria-label="خروج از حساب"
              title="خروج از حساب"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-sm transition-colors hover:border-danger/40 hover:text-danger sm:h-10 sm:w-10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-3 py-5 sm:px-4 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              مدیریت کافه‌ها
            </p>
            <h2 className="mt-1 text-xl font-black">کافه‌ها و کاربران</h2>
            <p className="mt-1 max-w-lg text-[11px] leading-5 text-ink-soft">
              برای هر کافه یک کاربر بسازید؛ کد QR جداگانه ساخته می‌شود و با حذف
              کاربر، همان QR از کار می‌افتد.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-[11px] font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-strong active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            افزودن کافه
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: Store, label: "کافه‌ها", value: stats.total },
            { icon: Power, label: "فعال", value: stats.active },
            { icon: UserRound, label: "کاربر", value: stats.owners },
            { icon: UtensilsCrossed, label: "آیتم منو", value: stats.items },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-3.5"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-2 text-lg font-black tabular-nums">
                {formatNumber(item.value)}
              </p>
              <p className="text-[10px] text-ink-faint">{item.label}</p>
            </div>
          ))}
        </div>

        {loadingList && (
          <p className="flex items-center gap-1.5 text-[10px] text-ink-faint">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            در حال به‌روزرسانی…
          </p>
        )}

        {restaurants.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-surface-muted/40 p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Coffee className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-black">هنوز کافه‌ای ساخته نشده</h3>
            <p className="mt-1 text-[11px] text-ink-faint">
              با دکمهٔ «افزودن کافه» اولین کافه و کاربرش را بسازید.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {restaurants.map((cafe) => (
              <li
                key={cafe.id}
                className={cn(
                  "rounded-3xl border border-line bg-surface p-4 shadow-card",
                  !cafe.is_active && "opacity-75",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                      {cafe.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cafe.logo_url}
                          alt={`لوگوی ${cafe.name}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Coffee className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black">
                        {cafe.label_word} {cafe.name}
                      </h3>
                      <p className="truncate text-[10px] text-ink-faint" dir="ltr">
                        /r/{cafe.slug}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[9px] font-bold",
                        cafe.is_active
                          ? "bg-success-soft text-success"
                          : "bg-danger-soft text-danger",
                      )}
                    >
                      {cafe.is_active ? "فعال" : "غیرفعال"}
                    </span>
                    <Link
                      href={cafe.menu_path}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface-muted text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={`مشاهدهٔ منوی ${cafe.name}`}
                      title="مشاهدهٔ منو"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setQrCafe(cafe)}
                      aria-label="کد QR"
                      title="کد QR"
                      className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface-muted text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(cafe)}
                      aria-label="ویرایش کافه"
                      title="ویرایش"
                      className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface-muted text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(cafe)}
                      disabled={busyId === cafe.id}
                      aria-label={cafe.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}
                      title={cafe.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface-muted text-ink-soft transition-colors hover:border-warning/40 hover:text-warning disabled:opacity-50"
                    >
                      {busyId === cafe.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cafe)}
                      aria-label="حذف کافه"
                      title="حذف"
                      className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface-muted text-ink-faint transition-colors hover:border-danger/40 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-[10px] sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-faint">کاربر پنل</dt>
                    <dd className="mt-0.5 font-bold" dir="ltr">
                      {cafe.owner_username ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">آیتم‌های منو</dt>
                    <dd className="mt-0.5 font-bold tabular-nums">
                      {formatNumber(cafe.item_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">دسته‌بندی</dt>
                    <dd className="mt-0.5 font-bold tabular-nums">
                      {formatNumber(cafe.category_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">وضعیت کاربر</dt>
                    <dd className="mt-0.5 font-bold">
                      {cafe.owner_is_active ? "اجازهٔ ورود دارد" : "بسته"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* ساخت کافه */}
      <Modal
        open={showCreate}
        onClose={() => !saving && setShowCreate(false)}
        labelledBy="create-cafe-title"
        placement="sheet"
        className="sm:max-w-lg"
      >
        <form onSubmit={submitCreate}>
          <div className="border-b border-line/60 px-5 pb-3 pt-5 pe-14">
            <h2 id="create-cafe-title" className="text-sm font-black">
              افزودن کافه و کاربر
            </h2>
            <p className="mt-1 text-[10px] text-ink-faint">
              بعد از ساخت، کد QR همین کافه آمادهٔ چاپ است.
            </p>
          </div>
          <div className="space-y-3 px-5 py-4">{formFields}</div>
          <div className="sticky bottom-0 flex gap-2 border-t border-line/60 bg-surface/95 px-5 py-3.5 backdrop-blur">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              ساخت کافه
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={saving}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </form>
      </Modal>

      {/* ویرایش کافه */}
      <Modal
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        labelledBy="edit-cafe-title"
        placement="sheet"
        className="sm:max-w-lg"
      >
        <form onSubmit={submitEdit}>
          <div className="border-b border-line/60 px-5 pb-3 pt-5 pe-14">
            <h2 id="edit-cafe-title" className="text-sm font-black">
              ویرایش {editing ? `${editing.label_word} ${editing.name}` : ""}
            </h2>
            <p className="mt-1 text-[10px] text-ink-faint">
              با تغییر نام کاربری یا رمز، نشست‌های قبلی آن کاربر بسته می‌شود.
            </p>
          </div>
          <div className="space-y-3 px-5 py-4">{formFields}</div>
          <div className="sticky bottom-0 flex gap-2 border-t border-line/60 bg-surface/95 px-5 py-3.5 backdrop-blur">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              ذخیرهٔ تغییرات
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={saving}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </form>
      </Modal>

      {/* QR */}
      <Modal
        open={qrCafe !== null}
        onClose={() => setQrCafe(null)}
        labelledBy="qr-title"
        className="sm:max-w-sm"
      >
        <div className="p-6 text-center">
          <h2 id="qr-title" className="text-sm font-black">
            کد QR {qrCafe ? `${qrCafe.label_word} ${qrCafe.name}` : ""}
          </h2>
          <p className="mt-1 text-[10px] text-ink-faint">
            مشتری با اسکن این کد فقط منوی همین کافه را می‌بیند.
          </p>

          <div className="mx-auto mt-4 w-fit rounded-2xl border border-line bg-white p-3">
            {qrCafe && (
              <QRCodeSVG
                value={`${baseUrl}${qrCafe.menu_path}`}
                size={180}
                bgColor="#ffffff"
                fgColor="#111827"
                level="M"
              />
            )}
          </div>

          <p className="mt-3 break-all text-[10px] text-ink-faint" dir="ltr">
            {baseUrl}
            {qrCafe?.menu_path}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => qrCafe && void copyLink(qrCafe)}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              کپی لینک
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-[10px] font-bold text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              پرینت
            </button>
          </div>

          {!qrCafe?.is_active && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-warning/30 bg-warning-soft px-2.5 py-2 text-right text-[10px] font-bold leading-5 text-warning">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              این کافه غیرفعال است؛ اسکن این کد فعلاً پیام «منو در دسترس نیست»
              نشان می‌دهد.
            </p>
          )}
        </div>
      </Modal>

      {/* حذف */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        labelledBy="delete-cafe-title"
        showClose={false}
        className="sm:max-w-sm"
      >
        <div className="p-5">
          <h2 id="delete-cafe-title" className="text-sm font-black">
            حذف {deleteTarget ? `${deleteTarget.label_word} ${deleteTarget.name}` : ""}؟
          </h2>
          <p className="mt-2 text-[11px] leading-6 text-ink-soft">
            با حذف، کافه و کاربرش غیرفعال می‌شوند: کد QR قبلی دیگر کار نمی‌کند و
            صاحب کافه نمی‌تواند وارد شود. داده‌ها پاک نمی‌شوند و بعداً می‌توانید
            کافه را دوباره فعال کنید.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-4 py-2.5 text-[11px] font-bold text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
            >
              {deleting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              حذف کن
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      </Modal>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
