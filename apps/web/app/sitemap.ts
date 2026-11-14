import type { MetadataRoute } from "next";

import { CITIES } from "@/lib/cities";
import { SITE_URL } from "@/lib/seo";
import { fetchPublicRestaurants } from "@/lib/server-api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...CITIES.map((city) => ({
      url: `${SITE_URL}/city/${city.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  const restaurants = await fetchPublicRestaurants({ revalidate: 3600 });

  return [
    ...staticRoutes,
    ...restaurants.map((restaurant) => ({
      url: `${SITE_URL}${restaurant.menu_path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
