"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AtSign,
  Check,
  ChevronLeft,
  Code2,
  Menu as MenuIcon,
  Palette,
  Phone,
  Send,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  THEMES,
  type ThemeId,
} from "@/lib/theme";

type GuestMenuDrawerProps = {
  /** نام مجموعه برای برچسب‌های دسترس‌پذیری. */
  restaurantName: string;
  /** شماره تماس مجموعه (بخش «مجموعه ما»). */
  phone?: string | null;
  /** شناسهٔ اینستاگرام مجموعه بدون @ (بخش «مجموعه ما»). */
  instagram?: string | null;
  /** تم پیش‌فرض صفحه برای رندر سمت سرور. */
  defaultTheme?: ThemeId;
  /** رفتار گزینهٔ «منو» (در نمای گفتگو به منو می‌رود؛ در نمای منو بالای صفحه). */
  onOpenMenu: () => void;
};

type DrawerSection = "theme" | "venue" | "developer" | null;

const DEVELOPER_TELEGRAM = "https://t.me/Ja_pr_z";
const DEVELOPER_TELEGRAM_ID = "@Ja_pr_z";
const DEVELOPER_PHONE = "09925770376";
const DEVELOPER_PHONE_TEL = "+989925770376";

/**
 * کشوی فهرست هدر صفحهٔ مشتری: منو، تغییر تم، مجموعه ما و توسعه‌دهنده.
 * در هر دو نمای «گفتگو» و «منو» در هدر قرار می‌گیرد.
 */
export default function GuestMenuDrawer({
  restaurantName,
  phone,
  instagram,
  defaultTheme,
  onOpenMenu,
}: GuestMenuDrawerProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<DrawerSection>(null);

  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => defaultTheme ?? getThemeServerSnapshot(),
  );

  const close = useCallback(() => {
    setOpen(false);
    setSection(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  const toggleSection = (next: Exclude<DrawerSection, null>) => {
    setSection((current) => (current === next ? null : next));
  };

  const openMenu = () => {
    close();
    onOpenMenu();
  };

  const sections: Array<{
    id: Exclude<DrawerSection, null>;
    label: string;
    icon: typeof Palette;
  }> = [
    { id: "theme", label: "تغییر تم", icon: Palette },
    { id: "venue", label: "مجموعه ما", icon: Store },
    { id: "developer", label: "توسعه‌دهنده", icon: Code2 },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`فهرست ${restaurantName}`}
        title="فهرست"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
      >
        <MenuIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="بستن فهرست"
            onClick={close}
            className="absolute inset-0 h-full w-full animate-fade cursor-default bg-black/45 backdrop-blur-sm"
          />
          <div className="animate-drawer absolute inset-y-0 right-0 z-10 flex w-72 max-w-[85vw] flex-col border-l border-line bg-canvas shadow-float">
            <div className="flex items-center justify-between border-b border-line/60 px-4 py-3.5">
              <p className="text-sm font-black">فهرست</p>
              <button
                type="button"
                onClick={close}
                aria-label="بستن فهرست"
                className="grid h-8 w-8 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              <button
                type="button"
                onClick={openMenu}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition-colors hover:bg-surface-muted"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-primary">
                  <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1 text-xs font-bold text-ink">منو</span>
                <ChevronLeft className="h-4 w-4 text-ink-faint" aria-hidden="true" />
              </button>

              {sections.map((item) => {
                const Icon = item.icon;
                const expanded = section === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSection(item.id)}
                      aria-expanded={expanded}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition-colors",
                        expanded
                          ? "bg-primary-soft text-primary"
                          : "hover:bg-surface-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                          expanded
                            ? "border-primary/30 bg-surface text-primary"
                            : "border-line bg-surface text-primary",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-xs font-bold",
                          expanded ? "text-primary" : "text-ink",
                        )}
                      >
                        {item.label}
                      </span>
                      <ChevronLeft
                        className={cn(
                          "h-4 w-4 transition-transform text-ink-faint",
                          expanded && "-rotate-90",
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {expanded && (
                      <div className="animate-fade mt-1 space-y-1 rounded-2xl border border-line/70 bg-surface/60 p-2">
                        {item.id === "theme" && (
                          <>
                            {THEMES.map((option) => {
                              const selected = option.id === theme;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setTheme(option.id)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-right transition-colors",
                                    selected
                                      ? "bg-primary-soft text-primary"
                                      : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                                  )}
                                >
                                  <span
                                    className="flex h-7 w-7 shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-line"
                                    style={{
                                      backgroundColor: option.swatches[1],
                                    }}
                                    aria-hidden="true"
                                  >
                                    <span
                                      className="h-3 w-1 rounded-full"
                                      style={{
                                        backgroundColor: option.swatches[0],
                                      }}
                                    />
                                    <span
                                      className="h-2 w-1 rounded-full"
                                      style={{
                                        backgroundColor: option.swatches[2],
                                      }}
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[11px] font-bold">
                                      {option.label}
                                    </span>
                                  </span>
                                  {selected && (
                                    <Check
                                      className="h-3.5 w-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}

                        {item.id === "venue" && (
                          <>
                            {phone ? (
                              <a
                                href={`tel:${phone.replace(/\s/g, "")}`}
                                className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                              >
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary">
                                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[9px] font-bold text-ink-faint">
                                    تلفن مجموعه
                                  </span>
                                  <span className="block text-[11px] font-bold" dir="ltr">
                                    {phone}
                                  </span>
                                </span>
                              </a>
                            ) : (
                              <p className="px-2.5 py-2 text-[11px] text-ink-faint">
                                شمارهٔ تماس ثبت نشده است.
                              </p>
                            )}
                            {instagram ? (
                              <a
                                href={`https://instagram.com/${encodeURIComponent(instagram)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                              >
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary">
                                  <AtSign
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[9px] font-bold text-ink-faint">
                                    اینستاگرام
                                  </span>
                                  <span
                                    className="block text-[11px] font-bold"
                                    dir="ltr"
                                  >
                                    @{instagram}
                                  </span>
                                </span>
                              </a>
                            ) : (
                              <p className="px-2.5 py-2 text-[11px] text-ink-faint">
                                اینستاگرام ثبت نشده است.
                              </p>
                            )}
                          </>
                        )}

                        {item.id === "developer" && (
                          <>
                            <a
                              href={DEVELOPER_TELEGRAM}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary">
                                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[9px] font-bold text-ink-faint">
                                  تلگرام
                                </span>
                                <span
                                  className="block text-[11px] font-bold"
                                  dir="ltr"
                                >
                                  {DEVELOPER_TELEGRAM_ID}
                                </span>
                              </span>
                            </a>
                            <a
                              href={`tel:${DEVELOPER_PHONE_TEL}`}
                              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary">
                                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[9px] font-bold text-ink-faint">
                                  تماس با توسعه‌دهنده
                                </span>
                                <span
                                  className="block text-[11px] font-bold"
                                  dir="ltr"
                                >
                                  {DEVELOPER_PHONE}
                                </span>
                              </span>
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <p className="border-t border-line/60 px-4 py-3 text-center text-[9px] text-ink-faint">
              {restaurantName}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
