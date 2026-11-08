"use client";

import React, { useCallback, useState, useEffect } from "react";
import NextImage from "next/image";
import { Send, Sparkles, AlertCircle, MessageCircle } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string | null;
  ingredients?: string[] | null;
  allergens?: string[] | null;
  is_spicy?: boolean | null;
  price?: {
    amount: number;
    currency: string;
  } | null;
  is_available: boolean;
}

interface RestaurantMenu {
  restaurant_slug: string;
  restaurant_name: string;
  items: MenuItem[];
}

interface PageProps {
  params: Promise<{ restaurantSlug: string }>;
}

export default function GuestMenuPage({ params }: PageProps) {
  const [slug, setSlug] = useState<string>("");
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // حالت‌های پرسش و پاسخ
  const [textQuestion, setTextQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const fetchMenu = useCallback(async (restaurantSlug: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/restaurants/${restaurantSlug}/menu`);
      if (!res.ok) {
        throw new Error("کافه مورد نظر یافت نشد.");
      }
      const data: RestaurantMenu = await res.json();
      setMenu(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "خطا در دریافت اطلاعات منو",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void params.then((resolvedParams) => {
      setSlug(resolvedParams.restaurantSlug);
      void fetchMenu(resolvedParams.restaurantSlug);
    });
  }, [params, fetchMenu]);

  // ارسال سؤال متنی
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuestion.trim() || isAsking) return;

    try {
      setIsAsking(true);
      setError(null);

      const res = await fetch(`/api/v1/restaurants/${slug}/ask-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textQuestion }),
      });

      if (!res.ok) throw new Error("خطا در دریافت پاسخ از دستیار");

      const data = await res.json();
      setAnswer(data.answer);
      setTextQuestion("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "خطا در دریافت پاسخ از دستیار",
      );
    } finally {
      setIsAsking(false);
    }
  };

  const menuCategories = menu
    ? Array.from(new Set(menu.items.map((item) => item.category)))
    : [];

  if (loading) {
    return (
      <div
        className="min-h-screen bg-amber-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="text-amber-800 font-bold text-lg animate-pulse">
          در حال دریافت منو...
        </div>
      </div>
    );
  }

  if (error && !menu) {
    return (
      <div
        className="min-h-screen bg-amber-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">خطا</h2>
          <p className="text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/50 pb-20" dir="rtl">
      {/* هدر کافه */}
      <header className="bg-amber-900 text-amber-50 py-6 px-4 shadow-md text-center rounded-b-3xl">
        <span className="text-xs bg-amber-800 px-3 py-1 rounded-full text-amber-200">
          منوی هوشمند
        </span>
        <h1 className="text-2xl font-bold mt-2">{menu?.restaurant_name}</h1>
        <p className="text-xs text-amber-200/80 mt-1">
          سؤال خود را به صورت متنی دربارهٔ منو بپرسید
        </p>
      </header>

      <main className="max-w-md mx-auto p-4">
        {/* چت در مرکز ناحیهٔ نمایش؛ منو بلافاصله بعد از آن قرار دارد. */}
        <div className="min-h-[calc(60svh-100px)] flex items-center justify-center py-4">
          <section className="w-full bg-white p-5 rounded-3xl shadow-sm border border-amber-100 space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm text-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>دستیار متنی منو</span>
            </div>

            {/* پاسخ هوش مصنوعی */}
            {answer && (
              <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-sm text-amber-950 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs mb-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>پاسخ دستیار:</span>
                </div>
                {answer}
              </div>
            )}

            <form onSubmit={handleSendText} className="flex gap-2">
              <input
                type="text"
                value={textQuestion}
                onChange={(e) => setTextQuestion(e.target.value)}
                placeholder="پرسش درباره منو..."
                disabled={isAsking}
                aria-label="سؤال درباره منو"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/20 text-slate-800"
              />
              <button
                type="submit"
                disabled={!textQuestion.trim() || isAsking}
                aria-label="ارسال سؤال"
                className="bg-amber-800 hover:bg-amber-900 text-white p-3 rounded-2xl disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {isAsking && (
              <p className="text-center text-xs text-amber-700 animate-pulse">
                در حال پردازش پاسخ توسط دستیار...
              </p>
            )}

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}
          </section>
        </div>

        {/* محصولات گروه‌بندی‌شده بر اساس دسته‌بندی */}
        <section className="space-y-6 mt-6">
          <h2 className="text-base font-bold text-slate-800 px-1">
            منوی محصولات
          </h2>
          {menuCategories.map((category) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="h-px flex-1 bg-amber-200" />
                <h3 className="text-sm font-bold text-amber-900">{category}</h3>
                <span className="h-px flex-1 bg-amber-200" />
              </div>
              {menu?.items
                .filter((item) => item.category === category)
                .map((item) => (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl shadow-sm border border-amber-100/60 overflow-hidden"
                  >
                    {item.image_url && (
                      <NextImage
                        src={item.image_url}
                        alt={item.name}
                        width={640}
                        height={360}
                        unoptimized
                        className="w-full h-44 object-cover bg-amber-50"
                      />
                    )}
                    <div className="p-4 flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-800">
                            {item.name}
                          </h3>
                          {item.is_spicy && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
                              تند
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="text-xs font-bold text-amber-900">
                          {item.price
                            ? (item.price.amount / 10).toLocaleString("fa-IR")
                            : 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          تومان
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </section>
      </main>
    </div>
  );
}
