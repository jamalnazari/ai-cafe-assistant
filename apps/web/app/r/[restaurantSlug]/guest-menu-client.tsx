"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Coffee, LoaderCircle } from "lucide-react";

import CustomerMenu from "@/components/customer-menu";
import MenuChat from "@/components/menu-chat";
import type { RestaurantMenu } from "@/lib/menu-types";
import type { ThemeId } from "@/lib/theme";
import { useMenuAssistant } from "@/lib/use-menu-assistant";

type CustomerView = "chat" | "menu";

type GuestMenuClientProps = {
  slug: string;
  initialMenu: RestaurantMenu;
  /** تم پیش‌فرض انتخابی صاحب کافه برای این صفحه. */
  defaultTheme?: ThemeId;
};

/**
 * رابط مشتری (چت دستیار و منو). محتوای اولیه روی سرور خوانده می‌شود تا
 * صفحه برای موتورهای جستجو کامل باشد؛ فقط «تلاش دوباره» دوباره درخواست می‌فرستد.
 */
export default function GuestMenuClient({
  slug,
  initialMenu,
  defaultTheme,
}: GuestMenuClientProps) {
  const [menu, setMenu] = useState<RestaurantMenu | null>(initialMenu);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<CustomerView>("chat");

  const assistant = useMenuAssistant(slug);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await fetch(`/api/v1/restaurants/${slug}/menu`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          "این منو در دسترس نیست؛ ممکن است این مجموعه غیرفعال شده باشد. " +
            "لطفاً از پرسنل مجموعه کمک بگیرید.",
        );
      }
      setMenu((await response.json()) as RestaurantMenu);
    } catch (fetchError: unknown) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "خطا در دریافت اطلاعات منو",
      );
    } finally {
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (!menu) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <CircleAlert className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-black">منو در دسترس نیست</h1>
          <p className="mt-2 text-xs leading-6 text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-60"
          >
            <LoaderCircle
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            تلاش دوباره
          </button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint">
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            دستیار هوشمند منو
          </p>
        </div>
      </div>
    );
  }

  if (view === "menu") {
    return (
      <CustomerMenu
        menu={menu}
        onBack={() => setView("chat")}
        defaultTheme={defaultTheme}
        onAsk={(question) => {
          setView("chat");
          void assistant.ask(question);
        }}
      />
    );
  }

  return (
    <MenuChat
      restaurantName={`${menu.restaurant_label ?? "کافه"} ${menu.restaurant_name}`.trim()}
      logoUrl={menu.logo_url ?? null}
      backgroundUrl={menu.background_url ?? null}
      assistant={assistant}
      defaultTheme={defaultTheme}
      phone={menu.restaurant_phone ?? null}
      instagram={menu.restaurant_instagram ?? null}
      onOpenMenu={() => setView("menu")}
    />
  );
}
