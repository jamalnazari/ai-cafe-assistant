"use client";

import React, { useCallback, useState, useEffect } from "react";
import NextImage from "next/image";
import {
  Send,
  Sparkles,
  AlertCircle,
  MessageCircle,
  LoaderCircle,
} from "lucide-react";

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

interface ConversationTurn {
  question: string;
  answer: string;
}

const MAX_CONVERSATION_TURNS = 6;

function formatAnswerForDisplay(answer: string): string {
  return answer
    .replace(/\r\n?/g, "\n")
    .replace(/([.!?؟…]+)([»"')\]]*)[ \t]+/g, "$1$2\n")
    .trim();
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
  const [lastQuestion, setLastQuestion] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    ConversationTurn[]
  >([]);

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

  // ارسال سؤال متنی همراه با گفتگوهای اخیر برای فهم سؤال‌های پیگیری
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = textQuestion.trim();
    if (!question || isAsking) return;

    try {
      setIsAsking(true);
      setError(null);
      setAnswer(null);

      const res = await fetch(`/api/v1/restaurants/${slug}/ask-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: conversationHistory.slice(-MAX_CONVERSATION_TURNS),
        }),
      });

      if (!res.ok) throw new Error("خطا در دریافت پاسخ از دستیار");

      const data = (await res.json()) as { answer: string };
      const nextAnswer = data.answer.trim();
      if (!nextAnswer) throw new Error("پاسخ خالی از دستیار دریافت شد.");

      setAnswer(nextAnswer);
      setLastQuestion(question);
      setConversationHistory((currentHistory) =>
        [...currentHistory, { question, answer: nextAnswer }].slice(
          -MAX_CONVERSATION_TURNS,
        ),
      );
      // متن سؤال در ورودی باقی می‌ماند تا مشتری بتواند آن را ویرایش یا دوباره بفرستد.
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
        <div className="min-h-[calc(60svh-100px)] flex flex-col items-center justify-center py-4">
          <section className="w-full bg-white p-5 rounded-3xl shadow-sm border border-amber-100 space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm text-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>دستیار متنی منو</span>
            </div>

            <form
              onSubmit={handleSendText}
              aria-busy={isAsking}
              className="flex gap-2"
            >
              <input
                type="text"
                value={textQuestion}
                onChange={(e) => setTextQuestion(e.target.value)}
                placeholder="پرسش درباره منو..."
                disabled={isAsking}
                maxLength={2000}
                aria-label="سؤال درباره منو"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-800/20 text-slate-800"
              />
              <button
                type="submit"
                disabled={!textQuestion.trim() || isAsking}
                aria-label={isAsking ? "در حال دریافت پاسخ" : "ارسال سؤال"}
                className="bg-amber-800 hover:bg-amber-900 text-white p-3 rounded-2xl disabled:opacity-40 transition-colors"
              >
                {isAsking ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}
          </section>

          {/* لودینگ در همان محل پاسخ، با انیمیشن و اسکلت متن */}
          {isAsking && (
            <section
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="w-full mt-4 overflow-hidden rounded-3xl border border-amber-100 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
                  <LoaderCircle className="h-5 w-5 animate-spin text-amber-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-950">
                    در حال آماده‌کردن پاسخ
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    دستیار در حال بررسی منو و نوشتن پاسخ است؛ لطفاً کمی صبر کنید.
                  </p>
                </div>
                <div className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-700"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-5 space-y-2.5" aria-hidden="true">
                <div className="h-2.5 animate-pulse rounded-full bg-amber-100" />
                <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-amber-100 [animation-delay:150ms]" />
                <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-amber-100 [animation-delay:300ms]" />
              </div>
            </section>
          )}

          {/* پاسخ مستقل، دقیقاً زیر کادر سؤال */}
          {answer && (
            <section
              aria-live="polite"
              aria-label="پاسخ دستیار"
              className="w-full mt-4 bg-amber-50/80 p-4 rounded-2xl border border-amber-200 text-sm text-amber-950"
            >
              <div className="mb-3 border-b border-amber-200/70 pb-3">
                <p className="text-[11px] font-bold text-slate-500">سؤال شما:</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                  {lastQuestion}
                </p>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs mb-2">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>پاسخ دستیار:</span>
              </div>
              <div className="whitespace-pre-line break-words leading-8">
                {formatAnswerForDisplay(answer)}
              </div>
            </section>
          )}
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
