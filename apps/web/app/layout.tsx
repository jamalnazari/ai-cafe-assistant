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
  themeColor: "#0c0a16",
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `
(function () {
  try {
    var allowed = ["amber", "purple", "emerald", "midnight"];
    var stored = window.localStorage.getItem("cafe-theme");
    var theme = stored && allowed.indexOf(stored) !== -1 ? stored : "midnight";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "midnight" ? "dark" : "light";
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
      data-theme="midnight"
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
