import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "دستیار هوشمند کافه",
    template: "%s | دستیار هوشمند کافه",
  },
  description:
    "منوی دیجیتال کافه با دستیار هوشمند پاسخ‌گو و پنل مدیریت صاحب کافه.",
  applicationName: "دستیار هوشمند کافه",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef",
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `
(function () {
  try {
    var allowed = ["amber", "purple", "emerald", "midnight"];
    var stored = window.localStorage.getItem("cafe-theme");
    if (stored && allowed.indexOf(stored) !== -1) {
      document.documentElement.dataset.theme = stored;
      document.documentElement.style.colorScheme =
        stored === "midnight" ? "dark" : "light";
    }
  } catch (error) {
    /* دسترسی به حافظه محلی ممکن نیست؛ تم پیش‌فرض استفاده می‌شود. */
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {children}
      </body>
    </html>
  );
}
