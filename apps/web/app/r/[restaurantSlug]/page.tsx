import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CafeInfoSection from "@/components/cafe-info-section";
import { cafeMetadata, faqJsonLd, restaurantJsonLd } from "@/lib/seo";
import { fetchMenuServer } from "@/lib/server-api";

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
      description: "این منو در دسترس نیست؛ ممکن است کافه غیرفعال شده باشد.",
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

  return (
    <main>
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

      <GuestMenuClient slug={menu.restaurant_slug} initialMenu={menu} />
      <CafeInfoSection menu={menu} />
    </main>
  );
}
