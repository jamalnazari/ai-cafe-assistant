"use client";

import React, { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BookOpen,
  CircleAlert,
  LoaderCircle,
  Send,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

import ItemDetailModal from "@/components/item-detail-modal";
import GuestMenuDrawer from "@/components/guest-menu-drawer";
import { formatItemPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/menu-types";
import type { ThemeId } from "@/lib/theme";
import type { MenuAssistantState } from "@/lib/use-menu-assistant";

type MenuChatProps = {
  restaurantName: string;
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  assistant: MenuAssistantState;
  /** تم پیش‌فرض انتخابی صاحب کافه برای صفحهٔ مشتری. */
  defaultTheme?: ThemeId;
  /** شماره تماس و اینستاگرام مجموعه برای بخش «مجموعه ما»ی کشو. */
  phone?: string | null;
  instagram?: string | null;
  onOpenMenu: () => void;
};

function formatAnswerForDisplay(answer: string): string {
  // پاسخ مدل ممکن است فهرست شماره‌دار یا چندخطی باشد؛ ساختار خطوط خودش
  // حفظ می‌شود تا شماره‌ها از متن آیتم جدا نشوند.
  return answer.replace(/\r\n?/g, "\n").trim();
}

export default function MenuChat({
  restaurantName,
  logoUrl,
  backgroundUrl,
  assistant,
  defaultTheme,
  phone,
  instagram,
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

  const welcome = (
    <div className="mx-auto flex w-full max-w-xl animate-rise flex-col items-center text-center">
      <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-on-primary shadow-lg shadow-primary/25">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`لوگوی ${restaurantName}`}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        )}
      </span>
      <h2 className="mt-4 text-lg font-black text-ink">
        به {restaurantName} خوش آمدید
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        چطور میتونم کمکتون کنم
      </p>
    </div>
  );

  const isWelcome =
    assistant.turns.length === 0 && !assistant.isAsking && !assistant.error;

  return (
    <div className="relative flex min-h-svh flex-col">
      {backgroundUrl && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <Image
            src={backgroundUrl}
            alt=""
            fill
            unoptimized
            priority
            className="object-cover"
          />
          {/* لایهٔ روشن ملایم تا تصویر کافه دیده شود و متن هم خوانا بماند */}
          <div className="absolute inset-0 bg-canvas/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/85 via-canvas/20 to-canvas/80" />
        </div>
      )}
      <header className="sticky top-0 z-40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-on-primary shadow-md shadow-primary/25">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`لوگوی ${restaurantName}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <h1 className="truncate text-sm font-black">{restaurantName}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <GuestMenuDrawer
              restaurantName={restaurantName}
              phone={phone}
              instagram={instagram}
              defaultTheme={defaultTheme}
              onOpenMenu={onOpenMenu}
            />
          </div>
        </div>
      </header>

      {/* نوار همیشگی «دیدن منو» زیر هدر؛ با اسکرول چت هم محو نمی‌شود */}
      <div className="sticky top-16 z-30 border-b border-line/40 bg-canvas/70 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-2">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary-soft px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            دیدن منو
          </button>
        </div>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-40 pt-5">
        {isWelcome ? (
          <div className="flex flex-1 flex-col justify-center py-4">{welcome}</div>
        ) : (
          <div className="flex flex-col gap-3">
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
                className="flex items-center gap-1.5 px-1 py-1.5"
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-2 w-2 animate-bounce rounded-full bg-primary"
                    style={{ animationDelay: `${dot * 150}ms` }}
                    aria-hidden="true"
                  />
                ))}
                <span className="sr-only">در حال دریافت پاسخ</span>
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

      <div className="fixed inset-x-0 bottom-2 z-40 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="relative mx-auto w-full max-w-3xl rounded-[32px] border border-dashed border-primary/45 p-4 backdrop-blur-xl">
          <span aria-hidden="true" className="chat-orbit-dot" />
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
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
              className="min-w-0 flex-1 bg-transparent px-3 py-6 text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || assistant.isAsking}
              aria-label={assistant.isAsking ? "در حال دریافت پاسخ" : "ارسال سؤال"}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {assistant.isAsking ? (
                <LoaderCircle
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </form>
        </div>
      </div>

      <ItemDetailModal
        item={selectedRecommendation}
        onClose={() => setSelectedRecommendation(null)}
      />
    </div>
  );
}
