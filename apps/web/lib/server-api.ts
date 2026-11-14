import type { PublicRestaurant, RestaurantMenu } from "@/lib/menu-types";

/** نشانی داخلی API؛ در سرور استفاده می‌شود (بدون رفت‌وبرگشت از اینترنت). */
const API_BASE = (
  process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(ms);
  } catch {
    return undefined;
  }
}

/** منوی یک کافه را روی سرور می‌خواند تا صفحه به‌صورت کامل رندر شود (سئو). */
export async function fetchMenuServer(
  slug: string,
): Promise<RestaurantMenu | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/restaurants/${encodeURIComponent(slug)}/menu`,
      {
        cache: "no-store",
        signal: timeoutSignal(5000),
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as RestaurantMenu;
  } catch {
    return null;
  }
}

/** فهرست کافه‌های فعال برای صفحهٔ شهر و نقشهٔ سایت. */
export async function fetchPublicRestaurants(
  options: { city?: string; revalidate?: number } = {},
): Promise<PublicRestaurant[]> {
  const { city, revalidate = 300 } = options;
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/public/restaurants${query}`,
      {
        next: { revalidate },
        signal: timeoutSignal(5000),
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) return [];
    return (await response.json()) as PublicRestaurant[];
  } catch {
    return [];
  }
}
