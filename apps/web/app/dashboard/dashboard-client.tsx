"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Coffee, LogOut, Plus, QrCode, Trash2 } from "lucide-react";
import type { RestaurantMenu } from "./dashboard-types";

type DashboardClientProps = {
  ownerEmail: string;
  qrUrl: string;
  initialMenu: RestaurantMenu | null;
};

async function getResponseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as {
    detail?: string;
  } | null;
  return data?.detail ?? fallback;
}

export default function DashboardClient({
  ownerEmail,
  qrUrl,
  initialMenu,
}: DashboardClientProps) {
  const router = useRouter();
  const [menu, setMenu] = useState<RestaurantMenu | null>(initialMenu);
  const [actionError, setActionError] = useState<string | null>(
    initialMenu ? null : "دریافت منو ناموفق بود؛ لطفاً دوباره تلاش کنید."
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("نوشیدنی گرم");
  const [description, setDescription] = useState("");
  const [priceToman, setPriceToman] = useState("");
  const [isSpicy, setIsSpicy] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/restaurants/demo/menu", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "دریافت منو ناموفق بود.")
        );
      }
      setMenu((await response.json()) as RestaurantMenu);
      setActionError(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "دریافت منو ناموفق بود."
      );
    }
  }, []);

  const handleExpiredSession = useCallback(
    (response: Response) => {
      if (response.status !== 401) return false;
      router.replace("/login");
      router.refresh();
      return true;
    },
    [router]
  );

  const resetForm = () => {
    setName("");
    setDescription("");
    setPriceToman("");
    setIsSpicy(false);
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !priceToman || saving) return;

    setSaving(true);
    setActionError(null);
    const priceRial = Number.parseInt(priceToman, 10) * 10;

    try {
      const response = await fetch("/api/v1/restaurants/demo/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          item_key: `item-${Date.now()}`,
          name,
          category,
          description,
          price_amount: priceRial,
          is_spicy: isSpicy,
        }),
      });

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "افزودن آیتم ناموفق بود.")
        );
      }

      setShowAddModal(false);
      resetForm();
      await fetchMenu();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "افزودن آیتم ناموفق بود."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemKey: string) => {
    if (!window.confirm("آیا از حذف این آیتم اطمینان دارید؟")) return;

    setDeletingItemKey(itemKey);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/restaurants/demo/items/${encodeURIComponent(itemKey)}`,
        { method: "DELETE", credentials: "same-origin" }
      );

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "حذف آیتم ناموفق بود.")
        );
      }
      await fetchMenu();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "حذف آیتم ناموفق بود."
      );
    } finally {
      setDeletingItemKey(null);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setActionError(null);

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("خروج از حساب ناموفق بود؛ دوباره تلاش کنید.");
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "خروج از حساب ناموفق بود."
      );
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-amber-100 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-amber-800 text-white rounded-xl flex items-center justify-center">
              <Coffee className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg text-slate-800">
                {menu?.restaurant_name ?? "پنل مدیریت کافه"}
              </h1>
              <p className="text-xs text-slate-500 truncate" dir="ltr">
                {ownerEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن آیتم جدید</span>
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-3 rounded-2xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4" />
              <span>{loggingOut ? "در حال خروج..." : "خروج"}</span>
            </button>
          </div>
        </header>

        {actionError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-100 text-red-700 text-xs font-bold p-3 rounded-2xl text-center space-y-2"
          >
            <p>{actionError}</p>
            {!menu && (
              <button
                type="button"
                onClick={() => void fetchMenu()}
                className="bg-white hover:bg-red-100 px-4 py-2 rounded-xl transition-colors"
              >
                تلاش دوباره
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 text-center space-y-4 md:col-span-1">
            <div className="flex items-center justify-center gap-1.5 text-amber-900 font-bold text-sm">
              <QrCode className="w-4 h-4" />
              <span>کد QR کافه</span>
            </div>
            <p className="text-xs text-slate-500">
              این کد را روی میزهای کافه قرار دهید
            </p>
            <div className="bg-amber-50 p-4 rounded-2xl inline-block border border-amber-100">
              <QRCodeSVG value={qrUrl} size={160} />
            </div>
            <button
              onClick={() => window.print()}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition-colors"
            >
              پرینت کد QR
            </button>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 space-y-4 md:col-span-2">
            <h2 className="font-bold text-sm text-slate-800">
              مدیریت آیتم‌های منو
            </h2>
            <div className="space-y-3">
              {menu?.items.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">
                  هنوز آیتمی در منو ثبت نشده است.
                </p>
              )}
              {menu?.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-xs text-slate-800">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {item.description}
                    </p>
                    <span className="text-xs font-bold text-amber-900 block mt-1">
                      {item.price ? (item.price.amount / 10).toLocaleString("fa-IR") : 0}{" "}
                      تومان
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={deletingItemKey === item.id}
                    className="p-2 shrink-0 text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
                    title="حذف آیتم"
                    aria-label={`حذف ${item.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-title"
            className="bg-white w-full max-w-md p-6 rounded-3xl shadow-lg space-y-4"
          >
            <h3 id="add-item-title" className="font-bold text-sm text-slate-800">
              افزودن آیتم جدید به منو
            </h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <input
                type="text"
                aria-label="نام غذا یا نوشیدنی"
                placeholder="نام غذا یا نوشیدنی"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-800/20"
              />
              <select
                aria-label="دسته‌بندی"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              >
                <option value="نوشیدنی گرم">نوشیدنی گرم</option>
                <option value="نوشیدنی سرد">نوشیدنی سرد</option>
                <option value="غذای گرم">غذای گرم</option>
                <option value="دسر">دسر</option>
              </select>
              <textarea
                aria-label="توضیحات و ترکیبات"
                placeholder="توضیحات و ترکیبات..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-800/20 h-20"
              />
              <input
                type="number"
                aria-label="قیمت به تومان"
                placeholder="قیمت به تومان (مثلا 145000)"
                value={priceToman}
                onChange={(event) => setPriceToman(event.target.value)}
                min="0"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-800/20"
              />
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpicy}
                  onChange={(event) => setIsSpicy(event.target.checked)}
                  className="rounded text-amber-800"
                />
                <span>طعم تند دارد</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-amber-800 hover:bg-amber-900 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                >
                  {saving ? "در حال ذخیره..." : "ذخیره آیتم"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs disabled:opacity-50"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
