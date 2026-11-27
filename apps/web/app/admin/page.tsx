import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import AdminClient from "./admin-client";
import type { AdminRestaurant } from "./types";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

type CurrentUser = {
  username: string | null;
  email: string | null;
  role: string;
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (!cookieHeader) {
    redirect("/login");
  }

  const response = await fetch(`${apiInternalUrl}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    redirect("/login");
  }

  const user = (await response.json()) as CurrentUser;

  // این پنل فقط برای مدیر سامانه است؛ صاحب کافه به پنل خودش می‌رود.
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const listResponse = await fetch(
    `${apiInternalUrl}/api/v1/admin/restaurants`,
    { headers: { cookie: cookieHeader }, cache: "no-store" }
  ).catch(() => null);

  const restaurants = listResponse?.ok
    ? ((await listResponse.json()) as AdminRestaurant[])
    : [];

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ??
    requestHeaders.get("host");
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  const baseUrl = host ? `${protocol}://${host}` : "";

  return (
    <AdminClient
      initialRestaurants={restaurants}
      baseUrl={baseUrl}
      adminUsername={user.username ?? user.email ?? ""}
    />
  );
}
