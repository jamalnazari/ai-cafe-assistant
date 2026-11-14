import { Clock, MapPin, Phone, Tags, UtensilsCrossed } from "lucide-react";

import type { RestaurantMenu } from "@/lib/menu-types";
import { cafeCity, cafeDisplayName } from "@/lib/seo";

/**
 * بخش متنی صفحهٔ عمومی کافه: معرفی، آدرس، تلفن، ساعت کاری و پرسش‌های پرتکرار.
 * این بخش روی سرور رندر می‌شود تا موتور جستجو محتوای واقعی کافه را ببیند.
 */
export default function CafeInfoSection({ menu }: { menu: RestaurantMenu }) {
  const name = cafeDisplayName(menu);
  const city = cafeCity(menu);
  const faq = (menu.faq ?? []).filter((item) => item.question && item.answer);
  const tags = (menu.cuisine_tags ?? []).filter(Boolean);
  const hasContact =
    menu.restaurant_address ||
    menu.restaurant_phone ||
    menu.opening_hours ||
    menu.price_range;

  return (
    <section
      aria-labelledby="cafe-info-title"
      className="mx-auto w-full max-w-3xl space-y-4 border-t border-line/60 px-4 py-8"
    >
      <h2 id="cafe-info-title" className="text-base font-black text-ink">
        دربارهٔ {name}
      </h2>

      {menu.restaurant_about ? (
        <p className="whitespace-pre-line text-xs leading-6 text-ink-soft">
          {menu.restaurant_about}
        </p>
      ) : (
        <p className="text-xs leading-6 text-ink-soft">
          منوی کامل {name} در {city} همراه با قیمت‌ها، دستیار هوشمند پاسخ‌گو و
          امکان راهنمایی برای انتخاب غذا و نوشیدنی.
        </p>
      )}

      {hasContact ? (
        <dl className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-xs sm:grid-cols-2">
          {menu.restaurant_address ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="font-bold text-ink">آدرس</dt>
                <dd className="leading-6 text-ink-soft">
                  <address className="not-italic">{menu.restaurant_address}</address>
                </dd>
              </div>
            </div>
          ) : null}

          {menu.restaurant_phone ? (
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="font-bold text-ink">تلفن</dt>
                <dd className="leading-6 text-ink-soft">
                  <a
                    href={`tel:${menu.restaurant_phone.replace(/[^\d+]/g, "")}`}
                    dir="ltr"
                    className="hover:text-primary"
                  >
                    {menu.restaurant_phone}
                  </a>
                </dd>
              </div>
            </div>
          ) : null}

          {menu.opening_hours ? (
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="font-bold text-ink">ساعت کاری</dt>
                <dd className="leading-6 text-ink-soft">{menu.opening_hours}</dd>
              </div>
            </div>
          ) : null}

          {menu.price_range ? (
            <div className="flex items-start gap-2">
              <UtensilsCrossed
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <dt className="font-bold text-ink">محدودهٔ قیمت</dt>
                <dd className="leading-6 text-ink-soft">{menu.price_range}</dd>
              </div>
            </div>
          ) : null}
        </dl>
      ) : null}

      {tags.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Tags className="h-4 w-4 text-ink-faint" aria-hidden="true" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-ink-soft"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {faq.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-black text-ink">پرسش‌های پرتکرار</h3>
          {faq.map((item) => (
            <details
              key={item.question}
              className="rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <summary className="cursor-pointer text-xs font-bold text-ink">
                {item.question}
              </summary>
              <p className="mt-2 text-xs leading-6 text-ink-soft">{item.answer}</p>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
