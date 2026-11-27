import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CafeInfoSection from "@/components/cafe-info-section";
import { cafeMetadata, faqJsonLd, restaurantJsonLd } from "@/lib/seo";
import { fetchMenuServer } from "@/lib/server-api";
import { isThemeId } from "@/lib/theme";

import GuestMenuClient from "./guest-menu-client";

interface PageProps {
  params: Promise<{ restaurantSlug: string }>;
}

/**
 * صفحهٔ عمومی کافه: کاملاً روی سرور رندر می‌شود تا موتور جستجو عنوان، توضیحات،
 * منو، آدرس و ساعت کاری را ببیند و نتیجهٔ محلی («رستوران … در گرگان») بگیرد.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const menu = await fetchMenuServer(restaurantSlug);
  if (!menu) {
    return {
      title: "منو در دسترس نیست",
      description: "این منو در دسترس نیست؛ ممکن است این مجموعه غیرفعال شده باشد.",
      robots: { index: false, follow: false },
    };
  }
  return cafeMetadata(menu);
}

export default async function GuestMenuPage({ params }: PageProps) {
  const { restaurantSlug } = await params;
  const menu = await fetchMenuServer(restaurantSlug);
  if (!menu) notFound();

  const restaurant = restaurantJsonLd(menu);
  const faq = faqJsonLd(menu);
  // تم پیش‌فرض این کافه (اگر صاحب کافه انتخاب کرده باشد)؛ بر تم سراسری مقدم است
  // مگر اینکه بازدیدکننده قبلاً تمی را در مرورگر خودش ذخیره کرده باشد.
  const theme = isThemeId(menu.restaurant_theme) ? menu.restaurant_theme : undefined;

  return (
    <main>
      {theme ? (
        <script
          // قبل از رنگ‌آمیزی صفحه اجرا می‌شود تا فلش تم پیش‌فرض دیده نشود.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var ok=["amber","purple","emerald","midnight"];var s=localStorage.getItem("cafe-theme");if(!s||ok.indexOf(s)===-1){var t=${JSON.stringify(
              theme,
            )};document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==="midnight"?"dark":"light";}}catch(e){}})();`,
          }}
        />
      ) : null}
      <script
        type="application/ld+json"
        // دادهٔ ساخت‌یافته از داده‌های خودِ کافه ساخته می‌شود و JSON.stringify امن است.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurant) }}
      />
      {faq ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
        />
      ) : null}

      <GuestMenuClient
        slug={menu.restaurant_slug}
        initialMenu={menu}
        defaultTheme={theme}
      />
      <CafeInfoSection menu={menu} />
    </main>
  );
}
