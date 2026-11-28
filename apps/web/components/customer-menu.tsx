"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CakeSlice,
  ChevronLeft,
  Coffee,
  CupSoda,
  EggFried,
  Flame,
  Leaf,
  Pizza,
  Salad,
  Sandwich,
  Send,
  UtensilsCrossed,
} from "lucide-react";

import ItemDetailModal from "@/components/item-detail-modal";
import GuestMenuDrawer from "@/components/guest-menu-drawer";
import MenuCategoryNav from "@/components/menu-category-nav";
import { formatItemPrice, formatNumber } from "@/lib/format";
import type { MenuItem, RestaurantMenu } from "@/lib/menu-types";
import type { ThemeId } from "@/lib/theme";
import { useCategoryScrollSpy } from "@/lib/use-category-scroll-spy";

type CustomerMenuProps = {
  menu: RestaurantMenu;
  onBack: () => void;
  onAsk: (question: string) => void;
  /** تم پیش‌فرض انتخابی صاحب کافه برای صفحهٔ مشتری. */
  defaultTheme?: ThemeId;
};

function categoryIcon(categoryName: string) {
  if (/سالاد/.test(categoryName)) return Salad;
  if (/پیتزا/.test(categoryName)) return Pizza;
  if (/ساندویچ|برگر|سوپ|غذا|پیش‌غذا/.test(categoryName)) return Sandwich;
  if (/دسر|شیرینی|کیک|بستنی/.test(categoryName)) return CakeSlice;
  if (/صبحانه|املت|تخم/.test(categoryName)) return EggFried;
  if (/دمنوش|چای|گیاه/.test(categoryName)) return Leaf;
  if (/سرد|آیس|شیک|اسموتی|لیموناد|آبمیوه/.test(categoryName)) return CupSoda;
  if (/گرم|قهوه|اسپرسو|نوشیدنی/.test(categoryName)) return Coffee;
  return UtensilsCrossed;
}

export default function CustomerMenu({
  menu,
  onBack,
  onAsk,
  defaultTheme,
}: CustomerMenuProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [question, setQuestion] = useState("");

  const items = menu.items;

  const categoryList = useMemo(() => {
    const names = Array.from(
      new Set([
        ...(menu.categories ?? []),
        ...menu.items.map((item) => item.category),
      ]),
    );
    return names
      .map((name) => ({
        name,
        count: menu.items.filter((item) => item.category === name).length,
      }))
      .filter((category) => category.count > 0);
  }, [menu]);

  const categoryNames = useMemo(
    () => categoryList.map((category) => category.name),
    [categoryList],
  );

  const { activeCategory, navRef, menuRef, scrollToCategory } =
    useCategoryScrollSpy(categoryNames);

  const handleAsk = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestion("");
    onAsk(trimmed);
  };

  return (
    <div className="relative min-h-screen pb-40">
      {menu.background_url && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <Image
            src={menu.background_url}
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
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت به گفتگو"
            title="بازگشت به گفتگو"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-ink-soft shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span className="hidden text-[10px] font-bold sm:inline">گفتگو</span>
          </button>
          {menu.logo_url && (
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <Image
                src={menu.logo_url}
                alt={`لوگوی ${menu.restaurant_name}`}
                fill
                unoptimized
                className="object-cover"
              />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-black">
              {menu.restaurant_name}
            </h1>
            <p className="mt-0.5 text-[10px] text-ink-faint">
              {formatNumber(items.length)} آیتم ·{" "}
              {formatNumber(categoryList.length)} دسته‌بندی
            </p>
          </div>
          <GuestMenuDrawer
            restaurantName={menu.restaurant_name}
            phone={menu.restaurant_phone}
            instagram={menu.restaurant_instagram}
            defaultTheme={defaultTheme}
            onOpenMenu={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
        </div>
      </header>

      <MenuCategoryNav
        categories={categoryList}
        totalCount={items.length}
        active={activeCategory}
        onSelect={scrollToCategory}
        navRef={navRef}
        tone="none"
        showLabel={false}
        topClassName="top-16"
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 pt-5 pb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-black">
              منوی {menu.restaurant_label?.trim() || "کافه"}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              برای دیدن ترکیبات و جزئیات، روی هر آیتم بزنید
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold text-ink-soft">
            {formatNumber(items.length)} آیتم
          </span>
        </div>

        {categoryList.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line bg-surface/70 p-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Coffee className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-black">
              هنوز آیتمی به منو اضافه نشده
            </h3>
            <p className="mt-2 text-[11px] leading-6 text-ink-soft">
              صاحب {menu.restaurant_label?.trim() || "کافه"} به‌زودی منوی خود را در این صفحه قرار می‌دهد.
            </p>
          </div>
        )}

        <div ref={menuRef} className="space-y-7">
          {categoryList.map((category) => {
            const Icon = categoryIcon(category.name);
            const categoryItems = items.filter(
              (item) => item.category === category.name,
            );
            return (
              <section
                key={category.name}
                data-category-name={category.name}
                className="scroll-mt-28 space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line bg-surface text-primary shadow-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-black">{category.name}</h3>
                  <span className="text-[10px] font-bold text-ink-faint">
                    {formatNumber(category.count)} آیتم
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className={`group flex w-full items-stretch gap-3 rounded-2xl border border-line bg-surface p-2.5 text-right shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-float active:translate-y-0 ${
                        item.is_available ? "" : "opacity-70"
                      }`}
                    >
                      <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={168}
                            height={168}
                            unoptimized
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <span className="grid h-full place-items-center text-primary/70">
                            <Coffee className="h-6 w-6" aria-hidden="true" />
                          </span>
                        )}
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                        <span className="block">
                          <span className="flex items-start justify-between gap-2">
                            <span className="line-clamp-1 text-sm font-bold text-ink">
                              {item.name}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              {item.is_spicy && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[9px] font-bold text-danger">
                                  <Flame
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                  تند
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-ink-soft">
                            {item.description}
                          </span>
                        </span>

                        <span className="mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-primary">
                              {formatItemPrice(item.price)}
                            </span>
                            <span className="text-[9px] font-bold text-ink-faint">
                              تومان
                            </span>
                          </span>
                          {!item.is_available && (
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-bold text-ink-faint">
                              ناموجود
                            </span>
                          )}
                          <ChevronLeft
                            className="h-4 w-4 text-ink-faint transition-colors group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* کادر پرسش؛ دقیقاً مثل کادر چت صفحهٔ اول */}
      <div className="fixed inset-x-0 bottom-2 z-30 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="chat-glow-border relative mx-auto w-full max-w-3xl rounded-[32px] border border-dashed border-primary/45 p-4 backdrop-blur-xl">
          <form onSubmit={handleAsk} className="flex items-center gap-2">
            <input
              id="menu-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="سؤالت را دربارهٔ منو بنویس..."
              maxLength={2000}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="سؤال درباره منو"
              className="min-w-0 flex-1 bg-transparent px-3 py-6 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={!question.trim()}
              aria-label="ارسال سؤال"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
