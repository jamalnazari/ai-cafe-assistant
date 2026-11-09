import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export const rootDir = resolve(currentDir, "..", "..");
export const apiDir = join(rootDir, "apps", "api");
export const webDir = join(rootDir, "apps", "web");
export const isWindows = process.platform === "win32";

const pythonCandidates = isWindows
  ? [
      join(apiDir, ".venv", "Scripts", "python.exe"),
      join(rootDir, ".venv", "Scripts", "python.exe"),
    ]
  : [
      join(apiDir, ".venv", "bin", "python"),
      join(rootDir, ".venv", "bin", "python"),
    ];

/** مسیر مفسر پایتون داخل محیط مجازی، یا null اگر ساخته نشده باشد. */
export function findPython() {
  return pythonCandidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** همان تابع قبلی، ولی در صورت نبودن محیط مجازی با پیام فارسی خارج می‌شود. */
export function requirePython() {
  const python = findPython();
  if (!python) {
    console.error(
      "[Cafe] محیط مجازی پایتون پیدا نشد. ابتدا در apps/api این دستورها را اجرا کنید:\n" +
        "       python -m venv .venv\n" +
        (isWindows
          ? "       .venv\\Scripts\\python.exe -m pip install -r requirements.txt\n"
          : "       .venv/bin/pip install -r requirements.txt\n"),
    );
    process.exit(1);
  }
  return python;
}

export function envInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
