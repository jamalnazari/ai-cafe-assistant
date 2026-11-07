import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import DashboardClient from "./dashboard-client";
import type { RestaurantMenu } from "./dashboard-types";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

type OwnerResponse = {
  email: string;
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (!cookieHeader) {
    redirect("/login");
  }

  // بررسی واقعی نشست در بک‌اند؛ صرف وجود کوکی برای دسترسی کافی نیست.
  const response = await fetch(`${apiInternalUrl}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    redirect("/login");
  }

  const owner = (await response.json()) as OwnerResponse;
  const menuResponse = await fetch(
    `${apiInternalUrl}/api/v1/restaurants/demo/menu`,
    { headers: { cookie: cookieHeader }, cache: "no-store" }
  ).catch(() => null);
  const initialMenu = menuResponse?.ok
    ? ((await menuResponse.json()) as RestaurantMenu)
    : null;

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ??
    requestHeaders.get("host");
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  const qrUrl = host ? `${protocol}://${host}/r/demo` : "/r/demo";

  return (
    <DashboardClient
      ownerEmail={owner.email}
      qrUrl={qrUrl}
      initialMenu={initialMenu}
    />
  );
}
