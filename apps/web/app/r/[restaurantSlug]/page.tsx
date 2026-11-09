"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Coffee, LoaderCircle } from "lucide-react";

import CustomerMenu from "@/components/customer-menu";
import MenuChat from "@/components/menu-chat";
import type { RestaurantMenu } from "@/lib/menu-types";
import { useMenuAssistant } from "@/lib/use-menu-assistant";

interface PageProps {
  params: Promise<{ restaurantSlug: string }>;
}

type CustomerView = "chat" | "menu";

export default function GuestMenuPage({ params }: PageProps) {
  const [slug, setSlug] = useState("");
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CustomerView>("chat");

  const assistant = useMenuAssistant(slug);

  const fetchMenu = useCallback(async (restaurantSlug: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/menu`,
      );
      if (!response.ok) {
        throw new Error("کافهٔ مورد نظر یافت نشد.");
      }
      const data = (await response.json()) as RestaurantMenu;
      setMenu(data);
    } catch (fetchError: unknown) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "خطا در دریافت اطلاعات منو",
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

  useEffect(() => {
    if (menu?.restaurant_name) {
      document.title = `${menu.restaurant_name} | دستیار منو`;
    }
  }, [menu?.restaurant_name]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const categoryCount = useMemo(
    () => new Set((menu?.items ?? []).map((item) => item.category)).size,
    [menu],
  );

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col" aria-busy="true">
        <div className="h-16 border-b border-line/60 bg-canvas/80" />
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 animate-pulse rounded-xl bg-primary-soft" />
            <div className="h-32 w-4/5 animate-pulse rounded-3xl border border-line bg-surface" />
          </div>
          <div className="h-14 w-3/5 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-24 w-2/3 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
        <div className="fixed inset-x-0 bottom-0 h-24 border-t border-line/60 bg-canvas/80" />
        <span className="sr-only">در حال دریافت منو...</span>
      </div>
    );
  }

  if (error && !menu) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <CircleAlert className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-black">منو پیدا نشد</h1>
          <p className="mt-2 text-xs leading-6 text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => slug && void fetchMenu(slug)}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary-strong"
          >
            <LoaderCircle className="h-4 w-4" aria-hidden="true" />
            تلاش دوباره
          </button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint">
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
            دستیار هوشمند کافه
          </p>
        </div>
      </div>
    );
  }

  if (!menu) return null;

  if (view === "menu") {
    return (
      <CustomerMenu
        menu={menu}
        onBack={() => setView("chat")}
        onAsk={(question) => {
          setView("chat");
          void assistant.ask(question);
        }}
      />
    );
  }

  return (
    <MenuChat
      restaurantName={menu.restaurant_name}
      logoUrl={menu.logo_url ?? null}
      backgroundUrl={menu.background_url ?? null}
      itemCount={menu.items.length}
      categoryCount={categoryCount}
      assistant={assistant}
      onOpenMenu={() => setView("menu")}
    />
  );
}
