"use client";

import Image from "next/image";
import {
  Flame,
  Image as ImageIcon,
  Leaf,
  Sparkles,
  Thermometer,
  TriangleAlert,
  Wheat,
} from "lucide-react";

import Modal from "@/components/ui/modal";
import { formatItemPrice } from "@/lib/format";
import type { MenuItem } from "@/lib/menu-types";

const TEMPERATURE_LABELS: Record<string, string> = {
  hot: "گرم",
  cold: "سرد",
  room_temperature: "دمای محیط",
};

type ItemDetailModalProps = {
  item: MenuItem | null;
  onClose: () => void;
};

export default function ItemDetailModal({
  item,
  onClose,
}: ItemDetailModalProps) {
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      placement="sheet"
      labelledBy="item-details-title"
      className="sm:max-w-md"
    >
      {item && (
        <div>
          <div className="relative h-48 w-full overflow-hidden bg-primary-soft sm:h-56">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center bg-[linear-gradient(135deg,var(--primary-soft),var(--surface-muted))] text-primary/60">
                <ImageIcon className="h-10 w-10" aria-hidden="true" />
              </div>
            )}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent"
            />
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  {item.category}
                </span>
                <h2
                  id="item-details-title"
                  className="mt-2 text-lg font-black leading-7"
                >
                  {item.name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.is_spicy && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      طعم تند
                    </span>
                  )}
                  {!item.is_available && (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-ink-faint">
                      فعلاً ناموجود
                    </span>
                  )}
                  {item.serving_temperature && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                      <Thermometer className="h-3 w-3" aria-hidden="true" />
                      {TEMPERATURE_LABELS[item.serving_temperature] ??
                        item.serving_temperature}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-lg font-black text-primary">
                  {formatItemPrice(item.price)}
                </p>
                <p className="text-[10px] font-bold text-ink-faint">تومان</p>
              </div>
            </div>

            {item.description && (
              <p className="text-xs leading-6 text-ink-soft">
                {item.description}
              </p>
            )}

            {item.ingredients && item.ingredients.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-black text-ink">
                  <Leaf className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  ترکیبات
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {item.ingredients.map((ingredient) => (
                    <span
                      key={ingredient}
                      className="rounded-full border border-line bg-surface-muted px-2 py-1 text-[10px] font-bold text-ink-soft"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.allergens && item.allergens.length > 0 && (
              <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-warning">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="text-[11px] font-black">حاوی آلرژن</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-bold">
                    <Wheat className="h-3 w-3" aria-hidden="true" />
                    {item.allergens.join("، ")}
                  </p>
                </div>
              </div>
            )}

            <p className="border-t border-line/70 pt-3 text-center text-[10px] text-ink-faint">
              برای ثبت سفارش، شمارهٔ میز یا آیتم را به کارکنان کافه بگویید.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
