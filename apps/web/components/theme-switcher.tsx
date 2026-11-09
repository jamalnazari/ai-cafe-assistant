"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Check, Palette } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  THEMES,
  type ThemeId,
} from "@/lib/theme";

type ThemeSwitcherProps = {
  variant?: "surface" | "onPrimary" | "ghost";
  showLabel?: boolean;
  className?: string;
};

const PANEL_WIDTH = 240;
const PANEL_ESTIMATED_HEIGHT = 320;

const triggerStyles: Record<
  NonNullable<ThemeSwitcherProps["variant"]>,
  string
> = {
  surface:
    "border border-line bg-surface text-ink-soft shadow-sm hover:border-line-strong hover:text-ink",
  onPrimary:
    "border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
  ghost:
    "border border-transparent text-ink-soft hover:bg-surface-muted hover:text-ink",
};

export default function ThemeSwitcher({
  variant = "surface",
  showLabel = true,
  className,
}: ThemeSwitcherProps) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // کادر انتخاب تم در Portal رندر می‌شود تا در هدرهای دارای overflow
  // بریده نشود و همیشه روی نوار دسته‌بندی‌ها و کارت‌ها قرار بگیرد.
  const updatePosition = useCallback(() => {
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return;

    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, trigger.right - width),
      window.innerWidth - width - 8,
    );
    const fitsBelow =
      window.innerHeight - trigger.bottom > PANEL_ESTIMATED_HEIGHT + 16;
    const top = fitsBelow
      ? trigger.bottom + 8
      : Math.max(8, trigger.top - PANEL_ESTIMATED_HEIGHT - 8);

    setPosition({ top, left, width });
  }, []);

  const togglePicker = () => {
    if (open) {
      setOpen(false);
      return;
    }
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleViewportChange = () => updatePosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const current = THEMES.find((option) => option.id === theme) ?? THEMES[0];

  const selectTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={togglePicker}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`انتخاب تم ظاهری؛ تم فعلی ${current.label}`}
        title="تغییر تم ظاهری سایت"
        className={cn(
          "flex h-10 items-center gap-2 rounded-full px-3 text-xs font-bold transition-colors",
          triggerStyles[variant],
        )}
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        {showLabel && <span className="hidden sm:inline">{current.label}</span>}
        <span
          className="h-3.5 w-3.5 rounded-full ring-2 ring-white/60"
          style={{ backgroundColor: current.swatches[0] }}
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="انتخاب تم"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[80] origin-top animate-fade rounded-2xl border border-line bg-surface p-2 shadow-float"
          >
            <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              تم ظاهری سایت
            </p>
            {THEMES.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => selectTheme(option.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right transition-colors",
                    selected
                      ? "bg-primary-soft text-primary"
                      : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-line"
                    style={{ backgroundColor: option.swatches[1] }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-3.5 w-1.5 rounded-full"
                      style={{ backgroundColor: option.swatches[0] }}
                    />
                    <span
                      className="h-2.5 w-1.5 rounded-full"
                      style={{ backgroundColor: option.swatches[2] }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">
                      {option.label}
                    </span>
                    <span className="block text-[10px] text-ink-faint">
                      {option.hint}
                    </span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
