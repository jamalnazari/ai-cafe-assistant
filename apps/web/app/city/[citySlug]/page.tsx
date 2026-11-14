import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Phone, UtensilsCrossed } from "lucide-react";

import { CITIES, findCity } from "@/lib/cities";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { fetchPublicRestaurants } from "@/lib/server-api";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ citySlug: string }>;
}

export function generateStaticParams() {
  return CITIES.map((city) => ({ citySlug: city.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const city = findCity(citySlug);
  if (!city) return { title: "شهر یافت نشد", robots: { index: false } };

  const title = `غذای ایرانی در ${city.name} | رستوران‌ها و کافه‌های ${city.name} با منوی آنلاین`;
  const description = `فهرست رستوران‌ها و کافه‌های ${city.name} در ${city.region} با منوی دیجیتال، قیمت، آدرس، تلفن و ساعت کاری. انتخاب غذای ایرانی در ${city.name} با راهنمای ${SITE_NAME}.`;
  const canonical = `${SITE_URL}/city/${city.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", locale: "fa_IR", url: canonical, siteName: SITE_NAME, title, description },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { citySlug } = await params;
  const city = findCity(citySlug);
  if (!city) notFound();

  const restaurants = await fetchPublicRestaurants({ city: city.name });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `رستوران‌ها و کافه‌های ${city.name}`,
    itemListElement: restaurants.map((restaurant, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${restaurant.label_word} ${restaurant.name}`,
      url: `${SITE_URL}${restaurant.menu_path}`,
    })),
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <nav aria-label="مسیر" className="text-[10px] text-ink-faint">
        <Link href="/" className="hover:text-primary">
          خانه
        </Link>
        <span className="mx-1">/</span>
        <span>{city.name}</span>
      </nav>

      <h1 className="mt-3 text-2xl font-black leading-9 text-ink">
        غذای ایرانی در {city.name}
      </h1>
      <p className="mt-3 text-xs leading-7 text-ink-soft">{city.intro}</p>

      <section aria-labelledby="cafes-title" className="mt-8 space-y-3">
        <h2 id="cafes-title" className="text-base font-black text-ink">
          کافه‌ها و رستوران‌های {city.name} با منوی دیجیتال
        </h2>

        {restaurants.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-soft">
            به‌زودی فهرست کافه‌های {city.name} در این صفحه منتشر می‌شود.
          </p>
        ) : (
          <ul className="space-y-3">
            {restaurants.map((restaurant) => (
              <li
                key={restaurant.slug}
                className="rounded-2xl border border-line bg-surface p-4"
              >
                <h3 className="text-sm font-black text-ink">
                  <Link href={restaurant.menu_path} className="hover:text-primary">
                    {restaurant.label_word} {restaurant.name}
                  </Link>
                </h3>
                {restaurant.about ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-ink-soft">
                    {restaurant.about}
                  </p>
                ) : null}
                <dl className="mt-3 grid gap-1.5 text-[11px] text-ink-soft sm:grid-cols-2">
                  {restaurant.address ? (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{restaurant.address}</span>
                    </div>
                  ) : null}
                  {restaurant.opening_hours ? (
                    <div className="flex items-start gap-1.5">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{restaurant.opening_hours}</span>
                    </div>
                  ) : null}
                  {restaurant.phone ? (
                    <div className="flex items-start gap-1.5">
                      <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <a href={`tel:${restaurant.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="hover:text-primary">
                        {restaurant.phone}
                      </a>
                    </div>
                  ) : null}
                  {restaurant.price_range ? (
                    <div className="flex items-start gap-1.5">
                      <UtensilsCrossed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{restaurant.price_range}</span>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(restaurant.cuisine_tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-ink-soft"
                    >
                      {tag}
                    </span>
                  ))}
                  <Link
                    href={restaurant.menu_path}
                    className="ms-auto rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-on-primary hover:bg-primary-strong"
                  >
                    دیدن منو
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="guide-title" className="mt-10 space-y-2">
        <h2 id="guide-title" className="text-base font-black text-ink">
          چطور در {city.name} غذای ایرانی انتخاب کنیم؟
        </h2>
        <p className="text-xs leading-7 text-ink-soft">
          برای انتخاب رستوران ایرانی در {city.name} به سه چیز نگاه کنید: تازگی
          مواد اولیهٔ غذاهای محلی، تنوع منو برای همهٔ سلیقه‌ها (گوشتی، گیاهی و
          دریایی) و ساعت کاری مطابق زمان مراجعه. در صفحهٔ هر کافه، منوی کامل با
          قیمت، آدرس دقیق و شمارهٔ تماس آمده است و دستیار هوشمند می‌تواند بر اساس
          بودجه، حساسیت غذایی یا تعداد نفرات پیشنهاد بدهد.
        </p>
        <p className="text-xs leading-7 text-ink-soft">
          اگر برای اولین بار به {city.name} سفر می‌کنید، غذاهای محلی گلستان مثل
          چکدرمه، ترکمنی، آش دوغ و کباب‌های سنتی را از دست ندهید.
        </p>
      </section>
    </main>
  );
}
