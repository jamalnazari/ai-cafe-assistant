import type { Metadata } from "next";

import type { RestaurantMenu } from "@/lib/menu-types";

/** نشانی عمومی سایت؛ در production با NEXT_PUBLIC_SITE_URL تنظیم می‌شود. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "دستیار هوشمند کافه";
export const DEFAULT_CITY = "گرگان";

export function cafeDisplayName(menu: RestaurantMenu): string {
  return `${menu.restaurant_label ?? "کافه"} ${menu.restaurant_name}`.trim();
}

export function cafeCity(menu: RestaurantMenu): string {
  return menu.city?.trim() || DEFAULT_CITY;
}

/** عنوان صفحهٔ کافه: نام + شهر + کاربرد (منو، آدرس، ساعت کاری). */
export function cafeTitle(menu: RestaurantMenu): string {
  return `${cafeDisplayName(menu)} در ${cafeCity(menu)} | منوی دیجیتال، آدرس و ساعت کاری`;
}

export function cafeDescription(menu: RestaurantMenu): string {
  const parts: string[] = [
    `منوی کامل ${cafeDisplayName(menu)} در ${cafeCity(menu)} با قیمت‌ها و دستیار هوشمند پاسخ‌گو.`,
  ];
  if (menu.restaurant_address) parts.push(`آدرس: ${menu.restaurant_address}`);
  if (menu.opening_hours) parts.push(`ساعت کاری: ${menu.opening_hours}`);
  if (menu.restaurant_phone) parts.push(`تلفن: ${menu.restaurant_phone}`);
  if (menu.restaurant_about) parts.push(menu.restaurant_about);
  const text = parts.join(" — ");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function cafeMetadata(menu: RestaurantMenu): Metadata {
  const canonical = `${SITE_URL}/r/${menu.restaurant_slug}`;
  const title = cafeTitle(menu);
  const description = cafeDescription(menu);
  const image = menu.background_url
    ? `${SITE_URL}${menu.background_url}`
    : menu.logo_url
      ? `${SITE_URL}${menu.logo_url}`
      : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

type JsonLd = Record<string, unknown>;

/** دادهٔ ساخت‌یافتهٔ schema.org برای رستوران/کافه؛ گوگل از آن برای نتایج محلی استفاده می‌کند. */
export function restaurantJsonLd(menu: RestaurantMenu): JsonLd {
  const url = `${SITE_URL}/r/${menu.restaurant_slug}`;
  const city = cafeCity(menu);
  const sameAsTags = (menu.cuisine_tags ?? []).filter(Boolean);

  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${url}#restaurant`,
    name: menu.restaurant_name,
    alternateName: cafeDisplayName(menu),
    url,
    currency: "IRR",
    servesCuisine: sameAsTags.length ? sameAsTags : ["ایرانی"],
    acceptsReservations: true,
    hasMenu: {
      "@type": "Menu",
      name: `منوی ${cafeDisplayName(menu)}`,
      hasMenuSection: (menu.categories ?? []).map((category) => ({
        "@type": "MenuSection",
        name: category,
        hasMenuItem: (menu.items ?? [])
          .filter((item) => item.category === category)
          .slice(0, 40)
          .map((item) => ({
            "@type": "MenuItem",
            name: item.name,
            description: item.description || undefined,
            offers: item.price
              ? {
                  "@type": "Offer",
                  price: item.price.amount,
                  priceCurrency: item.price.currency || "IRR",
                }
              : undefined,
          })),
      })),
    },
  };

  if (menu.restaurant_address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: menu.restaurant_address,
      addressLocality: city,
      addressRegion: city,
      addressCountry: "IR",
    };
  }
  if (menu.restaurant_phone) data.telephone = menu.restaurant_phone;
  if (menu.opening_hours) data.openingHours = menu.opening_hours;
  if (menu.price_range) data.priceRange = menu.price_range;
  if (menu.restaurant_about) data.description = menu.restaurant_about;
  if (menu.logo_url) data.logo = `${SITE_URL}${menu.logo_url}`;
  if (menu.background_url) data.image = `${SITE_URL}${menu.background_url}`;

  return data;
}

/** دادهٔ ساخت‌یافتهٔ پرسش‌های پرتکرار (نتیجه‌های غنی FAQ در گوگل). */
export function faqJsonLd(menu: RestaurantMenu): JsonLd | null {
  const faq = (menu.faq ?? []).filter((item) => item.question && item.answer);
  if (!faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
