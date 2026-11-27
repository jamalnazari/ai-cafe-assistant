import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
// ریشهٔ workspace همان پوشهٔ apps/web است؛ این مقدار جلوی حدس اشتباه Next.js
// (به‌خاطر وجود package-lock.json در ریشهٔ مخزن) را می‌گیرد.
const projectDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // نشانگر و منوی DevTools نکست فقط در محیط توسعه دیده می‌شود؛
  // برای اینکه روی رابط کاربری سایت ظاهر نشود، غیرفعال شده است.
  devIndicators: false,
  poweredByHeader: false,
  // خروجی مستقل برای تصویر Docker؛ حجم تصویر نهایی را چند برابر کم می‌کند.
  output: "standalone",
  compress: true,
  turbopack: {
    root: projectDir,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=()",
          },
          // HSTS فقط وقتی واقعاً HTTPS است معنا دارد؛ پشت Caddy/Nginx تنظیم می‌شود.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        // تصاویر آپلودی نام یکتا دارند؛ کش طولانی برای کاهش بار سرور.
        source: "/api/v1/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // دارایی‌های ساخته‌شدهٔ Next.js تغییرناپذیرند.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
