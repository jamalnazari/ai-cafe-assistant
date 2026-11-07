"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Trash2, QrCode, Coffee } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: { amount: number; currency: string } | null;
}

interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  items: MenuItem[];
}

export default function DashboardPage() {
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // فرم آیتم جدید
  const [name, setName] = useState("");
  const [category, setCategory] = useState("نوشیدنی گرم");
  const [description, setDescription] = useState("");
  const [priceToman, setPriceToman] = useState("");
  const [isSpicy, setIsSpicy] = useState(false);

  const [qrUrl, setQrUrl] = useState("http://localhost:3000/r/demo");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/r/demo`);
    }
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/restaurants/demo/menu");
      if (res.ok) {
        const data = await res.json();
        setMenu(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !priceToman) return;

    const priceRial = parseInt(priceToman, 10) * 10;
    const itemKey = `item-${Date.now()}`;

    try {
      const res = await fetch("/api/v1/restaurants/demo/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_key: itemKey,
          name,
          category,
          description,
          price_amount: priceRial,
          is_spicy: isSpicy,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setName("");
        setDescription("");
        setPriceToman("");
        setIsSpicy(false);
        fetchMenu();
      }
    } catch (err) {
      alert("خطا در اضافه کردن آیتم");
    }
  };

  const handleDeleteItem = async (itemKey: string) => {
    if (!confirm("آیا از حذف این آیتم اطمینان دارید؟")) return;

    try {
      const res = await fetch(`/api/v1/restaurants/demo/items/${itemKey}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMenu();
      }
    } catch (err) {
      alert("خطا در حذف آیتم");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-amber-800 font-bold" dir="rtl">
        در حال بارگذاری...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* هدر پنل */}
        <header className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-800 text-white rounded-xl flex items-center justify-center">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-800">{menu?.restaurant_name}</h1>
              <p className="text-xs text-slate-500">پنل مدیریت منو و کد QR</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold px-4 py-3 rounded-2xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن آیتم جدید</span>
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* بخش نمایش کد QR کافه جهت پرینت */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 text-center space-y-4 md:col-span-1">
            <div className="flex items-center justify-center gap-1.5 text-amber-900 font-bold text-sm">
              <QrCode className="w-4 h-4" />
              <span>کد QR کافه</span>
            </div>
            <p className="text-xs text-slate-500">این کد را روی میزهای کافه قرار دهید</p>
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

          {/* لیست و مدیریت آیتم‌ها */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-amber-100 space-y-4 md:col-span-2">
            <h2 className="font-bold text-sm text-slate-800">مدیریت آیتم‌های منو</h2>
            <div className="space-y-3">
              {menu?.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-xs text-slate-800">{item.name}</h3>
                    <p className="text-[11px] text-slate-500">{item.description}</p>
                    <span className="text-xs font-bold text-amber-900 block mt-1">
                      {item.price ? (item.price.amount / 10).toLocaleString() : 0} تومان
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="حذف آیتم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* مدال افزودن آیتم جدید */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-lg space-y-4">
            <h3 className="font-bold text-sm text-slate-800">افزودن آیتم جدید به منو</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <input
                type="text"
                placeholder="نام غذا یا نوشیدنی"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              >
                <option value="نوشیدنی گرم">نوشیدنی گرم</option>
                <option value="نوشیدنی سرد">نوشیدنی سرد</option>
                <option value="غذای گرم">غذای گرم</option>
                <option value="دسر">دسر</option>
              </select>
              <textarea
                placeholder="توضیحات و ترکیبات..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none h-20"
              />
              <input
                type="number"
                placeholder="قیمت به تومان (مثلا 145000)"
                value={priceToman}
                onChange={(e) => setPriceToman(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              />
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpicy}
                  onChange={(e) => setIsSpicy(e.target.checked)}
                  className="rounded text-amber-800"
                />
                <span>طعم تند دارد</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-800 text-white font-bold py-2.5 rounded-xl text-xs"
                >
                  ذخیره آیتم
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs"
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