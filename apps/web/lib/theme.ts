export type ThemeId = "amber" | "purple" | "emerald" | "midnight";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  hint: string;
  swatches: [string, string, string];
  themeColor: string;
};

export const THEMES: ThemeOption[] = [
  {
    id: "amber",
    label: "کهربایی",
    hint: "گرم و دنج",
    swatches: ["#a8550f", "#fbf6ef", "#c97a12"],
    themeColor: "#fbf6ef",
  },
  {
    id: "purple",
    label: "بنفش",
    hint: "مدرن و خلاق",
    swatches: ["#7c3aed", "#f8f5ff", "#c026d3"],
    themeColor: "#f8f5ff",
  },
  {
    id: "emerald",
    label: "نعنایی",
    hint: "تازه و طبیعی",
    swatches: ["#0f766e", "#f3faf7", "#0891b2"],
    themeColor: "#f3faf7",
  },
  {
    id: "midnight",
    label: "شبانه",
    hint: "تیره و آرام",
    swatches: ["#a78bfa", "#0c0a16", "#e879f9"],
    themeColor: "#0c0a16",
  },
];

export const DEFAULT_THEME: ThemeId = "amber";
export const THEME_STORAGE_KEY = "cafe-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" && THEMES.some((theme) => theme.id === value)
  );
}

export function applyTheme(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.style.colorScheme = themeId === "midnight" ? "dark" : "light";
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  const option = THEMES.find((theme) => theme.id === themeId);
  if (meta && option) meta.content = option.themeColor;
}

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function storeTheme(themeId: ThemeId) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // ذخیره‌سازی محلی در حالت‌های محدود (مثلاً حالت ناشناس) در دسترس نیست.
  }
}

// --- یک فروشگاه کوچک برای هم‌رسانی تم بین همهٔ نمونه‌های سوییچر ---
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (isThemeId(event.newValue)) applyTheme(event.newValue);
    notify();
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getThemeSnapshot(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const fromDocument = document.documentElement.dataset.theme;
  return isThemeId(fromDocument) ? fromDocument : DEFAULT_THEME;
}

export function getThemeServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function setTheme(themeId: ThemeId) {
  applyTheme(themeId);
  storeTheme(themeId);
  notify();
}
