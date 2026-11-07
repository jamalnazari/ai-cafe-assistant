"use client";

import React, { useCallback, useState } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Coffee,
  Image as ImageIcon,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Trash2,
} from "lucide-react";
import type { MenuItem, RestaurantMenu } from "./dashboard-types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "فرمت تصویر باید JPG، PNG یا WebP باشد.";
  }
  if (file.size === 0) return "فایل تصویر خالی است.";
  if (file.size > MAX_IMAGE_BYTES) {
    return "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";
  }
  return null;
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
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null);
  const [uploadingItemKey, setUploadingItemKey] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("نوشیدنی گرم");
  const [description, setDescription] = useState("");
  const [priceToman, setPriceToman] = useState("");
  const [isSpicy, setIsSpicy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  const uploadImageRequest = useCallback(
    async (itemKey: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/v1/restaurants/demo/items/${encodeURIComponent(itemKey)}/image`,
        {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        }
      );

      if (handleExpiredSession(response)) return false;
      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "بارگذاری تصویر ناموفق بود.")
        );
      }
      return true;
    },
    [handleExpiredSession]
  );

  const resetForm = () => {
    setEditingItemKey(null);
    setName("");
    setCategory("نوشیدنی گرم");
    setDescription("");
    setPriceToman("");
    setIsSpicy(false);
    setImageFile(null);
    setFormError(null);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingItemKey(null);
    setImageFile(null);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItemKey(item.id);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description);
    setPriceToman(item.price ? String(item.price.amount / 10) : "");
    setIsSpicy(item.is_spicy ?? false);
    setImageFile(null);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSelectNewImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setImageFile(null);
      setFormError(validationError);
      event.target.value = "";
      return;
    }

    setFormError(null);
    setImageFile(file);
  };

  const handleSubmitItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !priceToman || saving) return;

    setSaving(true);
    setActionError(null);
    setFormError(null);
    const isEditing = editingItemKey !== null;
    const priceRial = Number.parseInt(priceToman, 10) * 10;
    const itemKey = editingItemKey ?? `item-${Date.now()}`;
    const selectedImage = imageFile;
    let itemSaved = false;

    try {
      const response = await fetch(
        isEditing
          ? `/api/v1/restaurants/demo/items/${encodeURIComponent(itemKey)}`
          : "/api/v1/restaurants/demo/items",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...(isEditing ? {} : { item_key: itemKey }),
            name,
            category,
            description,
            price_amount: priceRial,
            is_spicy: isSpicy,
          }),
        }
      );

      if (handleExpiredSession(response)) return;
      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            isEditing ? "ویرایش آیتم ناموفق بود." : "افزودن آیتم ناموفق بود."
          )
        );
      }

      itemSaved = true;
      setShowAddModal(false);
      resetForm();

      if (selectedImage) {
        try {
          const uploaded = await uploadImageRequest(itemKey, selectedImage);
          if (!uploaded) return;
        } catch (error) {
          await fetchMenu();
          const reason =
            error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود.";
          throw new Error(
            `${isEditing ? "تغییرات" : "آیتم"} ذخیره شد، اما تصویر بارگذاری نشد. ${reason} می‌توانید از ردیف آیتم دوباره تلاش کنید.`
          );
        }
      }

      await fetchMenu();
    } catch (error) {
      const fallback = isEditing
        ? "ویرایش آیتم ناموفق بود."
        : "افزودن آیتم ناموفق بود.";
      const message = error instanceof Error ? error.message : fallback;
      if (itemSaved) {
        setActionError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (itemKey: string, file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setUploadingItemKey(itemKey);
    setActionError(null);
    try {
      const uploaded = await uploadImageRequest(itemKey, file);
      if (!uploaded) return;
      await fetchMenu();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "بارگذاری تصویر ناموفق بود."
      );
    } finally {
      setUploadingItemKey(null);
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
              onClick={openCreateModal}
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
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    {item.image_url ? (
                      <NextImage
                        src={item.image_url}
                        alt={item.name}
                        width={80}
                        height={80}
                        unoptimized
                        className="w-20 h-20 shrink-0 rounded-2xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-20 h-20 shrink-0 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-bold text-xs text-slate-800">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {item.description}
                      </p>
                      <span className="text-xs font-bold text-amber-900 block mt-1">
                        {item.price
                          ? (item.price.amount / 10).toLocaleString("fa-IR")
                          : 0}{" "}
                        تومان
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <label
                      className={`text-xs font-bold text-amber-800 hover:bg-amber-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                        uploadingItemKey === item.id
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>
                        {uploadingItemKey === item.id
                          ? "در حال بارگذاری..."
                          : item.image_url
                            ? "تغییر تصویر"
                            : "افزودن تصویر"}
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingItemKey === item.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void handleImageUpload(item.id, file);
                        }}
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-3 py-2 shrink-0 text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="ویرایش آیتم"
                      >
                        <Pencil className="w-4 h-4" />
                        <span>ویرایش</span>
                      </button>
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
                  </div>
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
            aria-labelledby="item-form-title"
            className="bg-white w-full max-w-md max-h-[90svh] overflow-y-auto p-6 rounded-3xl shadow-lg space-y-4"
          >
            <h3 id="item-form-title" className="font-bold text-sm text-slate-800">
              {editingItemKey ? "ویرایش آیتم" : "افزودن آیتم جدید به منو"}
            </h3>
            <form onSubmit={handleSubmitItem} className="space-y-3">
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
              <div className="space-y-1.5">
                <label
                  htmlFor="new-item-image"
                  className="text-xs font-bold text-slate-700"
                >
                  {editingItemKey
                    ? "تعویض تصویر (اختیاری)"
                    : "تصویر آیتم (اختیاری)"}
                </label>
                <input
                  id="new-item-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleSelectNewImage}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 file:bg-amber-100 file:text-amber-900 file:border-0 file:rounded-lg file:px-3 file:py-2 file:ml-3 file:text-xs file:font-bold cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  JPG، PNG یا WebP؛ حداکثر ۵ مگابایت
                </p>
                {imageFile && (
                  <p className="text-[11px] text-slate-500 truncate">
                    تصویر انتخاب‌شده: {imageFile.name}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpicy}
                  onChange={(event) => setIsSpicy(event.target.checked)}
                  className="rounded text-amber-800"
                />
                <span>طعم تند دارد</span>
              </label>
              {formError && (
                <p role="alert" className="text-xs text-red-600 text-center font-bold">
                  {formError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-amber-800 hover:bg-amber-900 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                >
                  {saving
                    ? "در حال ذخیره..."
                    : editingItemKey
                      ? "ذخیره تغییرات"
                      : "ذخیره آیتم"}
                </button>
                <button
                  type="button"
                  onClick={closeAddModal}
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
