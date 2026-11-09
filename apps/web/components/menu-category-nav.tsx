"use client";

import { useEffect, useRef } from "react";
import { LayoutGrid } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

export type CategoryNavItem = {
  name: string;
  count: number;
};

type MenuCategoryNavProps = {
  categories: CategoryNavItem[];
  totalCount: number;
  active: string | null;
  onSelect: (categoryName: string | null) => void;
  navRef: React.RefObject<HTMLElement | null>;
  tone?: "canvas" | "surface";
  className?: string;
  containerClassName?: string;
  topClassName?: string;
  action?: React.ReactNode;
  sticky?: boolean;
};

const ALL_KEY = "__all__";

export default function MenuCategoryNav({
  categories,
  totalCount,
  active,
  onSelect,
  navRef,
  tone = "canvas",
  className,
  containerClassName,
  topClassName = "top-0",
  action,
  sticky = true,
}: MenuCategoryNavProps) {
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const chip = chipRefs.current.get(active ?? ALL_KEY);
    chip?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  const renderChip = (
    key: string,
    label: string,
    count: number,
    isActive: boolean,
    onClick: () => void,
    leadingIcon?: React.ReactNode,
  ) => (
    <button
      key={key}
      type="button"
      ref={(element) => {
        if (element) chipRefs.current.set(key, element);
        else chipRefs.current.delete(key);
      }}
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all sm:text-xs",
        isActive
          ? "border-transparent bg-primary text-on-primary shadow-md shadow-primary/25"
          : "border-line bg-surface text-ink-soft hover:border-primary/40 hover:text-ink",
      )}
    >
      {leadingIcon}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          isActive
            ? "bg-white/20 text-on-primary"
            : "bg-surface-muted text-ink-faint group-hover:text-ink-soft",
        )}
      >
        {formatNumber(count)}
      </span>
    </button>
  );

  return (
    <nav
      ref={navRef}
      aria-label="دسته‌بندی‌های منو"
      className={cn(
        "z-30 border-b border-line/70 backdrop-blur-xl",
        sticky && "sticky",
        sticky && topClassName,
        tone === "canvas" ? "bg-canvas/85" : "bg-surface/90",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 py-2.5",
          containerClassName ?? "mx-auto max-w-5xl px-4",
        )}
      >
        <span className="hidden shrink-0 items-center gap-1.5 pe-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint lg:flex">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          دسته‌ها
        </span>
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
          {renderChip(
            ALL_KEY,
            "همه موارد",
            totalCount,
            active === null,
            () => onSelect(null),
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />,
          )}
          {categories.map((category) =>
            renderChip(
              category.name,
              category.name,
              category.count,
              active === category.name,
              () => onSelect(category.name),
            ),
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </nav>
  );
}
