"use client";

import React, { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BookOpen,
  Bot,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Tags,
  UtensilsCrossed,
} from "lucide-react";

import ItemDetailModal from "@/components/item-detail-modal";
import ThemeSwitcher from "@/components/theme-switcher";
import { formatItemPrice, formatNumber } from "@/lib/format";
import type { MenuItem } from "@/lib/menu-types";
import type { MenuAssistantState } from "@/lib/use-menu-assistant";

type MenuChatProps = {
  restaurantName: string;
  itemCount: number;
  categoryCount: number;
  assistant: MenuAssistantState;
  onOpenMenu: () => void;
};

const SUGGESTIONS = [
  "چه نوشیدنی سردی دارید؟",
  "کدام آیتم‌ها تند هستند؟",
  "ارزان‌ترین آیتم منو چقدر است؟",
];

function formatAnswerForDisplay(answer: string): string {
  // پاسخ مدل ممکن است فهرست شماره‌دار یا چندخطی باشد؛ ساختار خطوط خودش
  // حفظ می‌شود تا شماره‌ها از متن آیتم جدا نشوند.
  return answer.replace(/\r\n?/g, "\n").trim();
}

export default function MenuChat({
  restaurantName,
  itemCount,
  categoryCount,
  assistant,
  onOpenMenu,
}: MenuChatProps) {
  const [draft, setDraft] = useState("");
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<MenuItem | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [assistant.turns.length, assistant.isAsking, assistant.error]);

  const sendQuestion = (text: string) => {
    const question = text.trim();
    if (!question || assistant.isAsking) return;
    setDraft("");
    void assistant.ask(question);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendQuestion(draft);
  };

  const greeting = (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Bot className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 rounded-3xl rounded-tr-md border border-line bg-surface px-4 py-3 shadow-card">
        <p className="text-xs leading-6 text-ink">
          سلام 👋 من دستیار منوی{" "}
          <span className="font-black">{restaurantName}</span> هستم. هر سؤالی
          دربارهٔ ترکیبات، قیمت، تندی یا آلرژن‌ها داری بپرس.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-ink-soft">
            <UtensilsCrossed className="h-3 w-3" aria-hidden="true" />
            {formatNumber(itemCount)} آیتم
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-ink-soft">
            <Tags className="h-3 w-3" aria-hidden="true" />
            {formatNumber(categoryCount)} دسته‌بندی
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenMenu}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary-soft px-3 py-2.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          دیدن منوی کافه
        </button>
      </div>
    </div>
  );

  const isWelcome =
    assistant.turns.length === 0 && !assistant.isAsking && !assistant.error;

  return (
    <div className="relative flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas bg-success"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black">{restaurantName}</h1>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-success">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />
                دستیار منو آنلاین است
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenMenu}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[11px] font-bold text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary-strong"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              منو
            </button>
            <ThemeSwitcher variant="surface" showLabel={false} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-40 pt-5">
        {isWelcome ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-4">
            <div className="mx-auto w-full max-w-xl animate-rise">
              {greeting}
            </div>
            <div className="mx-auto w-full max-w-xl">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-ink-faint">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                با یکی از این سؤال‌ها شروع کن
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendQuestion(suggestion)}
                    className="group flex items-start gap-2 rounded-2xl border border-line bg-surface p-3 text-right shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-float"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-bold leading-5 text-ink-soft group-hover:text-ink">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {greeting}

            {assistant.turns.map((turn) => (
              <Fragment key={turn.id}>
                <div className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-primary px-3.5 py-2.5 text-[11px] leading-6 text-on-primary shadow-md shadow-primary/20">
                    {turn.question}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 max-w-[88%] space-y-2">
                    <div className="rounded-2xl rounded-tr-md border border-line bg-surface px-3.5 py-3 shadow-card">
                      <p className="whitespace-pre-line break-words text-[11px] leading-7 text-ink">
                        {formatAnswerForDisplay(turn.answer)}
                      </p>
                    </div>

                    {turn.recommendations.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-ink-faint">
                          پیشنهادهای منو
                        </p>
                        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                          {turn.recommendations.map((recommendation) => (
                            <button
                              key={recommendation.id}
                              type="button"
                              onClick={() =>
                                setSelectedRecommendation(recommendation)
                              }
                              className="group w-[132px] shrink-0 overflow-hidden rounded-2xl border border-line bg-surface text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-float"
                            >
                              <span className="relative block h-20 w-full overflow-hidden bg-primary-soft">
                                {recommendation.image_url ? (
                                  <Image
                                    src={recommendation.image_url}
                                    alt={recommendation.name}
                                    fill
                                    unoptimized
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <span className="grid h-full place-items-center text-primary/70">
                                    <UtensilsCrossed
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </span>
                                )}
                                {!recommendation.is_available && (
                                  <span className="absolute inset-x-1 bottom-1 rounded-md bg-surface/90 px-1 py-0.5 text-center text-[8px] font-bold text-ink-faint">
                                    ناموجود
                                  </span>
                                )}
                              </span>
                              <span className="block p-2">
                                <span className="line-clamp-1 block text-[10px] font-bold text-ink">
                                  {recommendation.name}
                                </span>
                                <span className="mt-0.5 flex items-baseline gap-0.5">
                                  <span className="text-[10px] font-black text-primary">
                                    {formatItemPrice(recommendation.price)}
                                  </span>
                                  <span className="text-[8px] text-ink-faint">
                                    تومان
                                  </span>
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}

            {assistant.pendingQuestion && (
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-primary px-3.5 py-2.5 text-[11px] leading-6 text-on-primary shadow-md shadow-primary/20">
                  {assistant.pendingQuestion}
                </p>
              </div>
            )}

            {assistant.isAsking && (
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex items-start gap-2.5"
              >
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0 max-w-[88%] rounded-2xl rounded-tr-md border border-line bg-surface px-3.5 py-3 shadow-card">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-ink">
                      دارم منو را بررسی می‌کنم...
                    </p>
                    <span
                      className="ms-auto flex items-center gap-1"
                      aria-hidden="true"
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: `${dot * 150}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2" aria-hidden="true">
                    <div className="h-2 animate-pulse rounded-full bg-line" />
                    <div className="h-2 w-5/6 animate-pulse rounded-full bg-line [animation-delay:150ms]" />
                    <div className="h-2 w-2/3 animate-pulse rounded-full bg-line [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {assistant.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[11px] font-bold text-danger"
              >
                <CircleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="leading-5">{assistant.error}</p>
              </div>
            )}

            <div ref={bottomRef} className="scroll-mb-40" />
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-canvas/90 backdrop-blur-xl">
        <div
          className="mx-auto w-full max-w-3xl px-4 pt-2.5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="سؤالت را دربارهٔ منو بنویس..."
              disabled={assistant.isAsking}
              maxLength={2000}
              aria-label="سؤال درباره منو"
              autoComplete="off"
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3.5 py-3 text-xs text-ink shadow-sm outline-none transition-all placeholder:text-ink-faint focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || assistant.isAsking}
              aria-label={assistant.isAsking ? "در حال دریافت پاسخ" : "ارسال سؤال"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {assistant.isAsking ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </form>
          <p className="mt-1.5 text-center text-[9px] text-ink-faint">
            پاسخ‌ها فقط بر اساس منوی همین کافه است.
          </p>
        </div>
      </div>

      <ItemDetailModal
        item={selectedRecommendation}
        onClose={() => setSelectedRecommendation(null)}
      />
    </div>
  );
}
