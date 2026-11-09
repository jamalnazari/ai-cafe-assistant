import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // نشانگر و منوی DevTools نکست فقط در محیط توسعه دیده می‌شود؛
  // برای اینکه روی رابط کاربری سایت ظاهر نشود، غیرفعال شده است.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;