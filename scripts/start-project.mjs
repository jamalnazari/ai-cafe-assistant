import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

import {
  apiDir,
  envInt,
  isWindows,
  requirePython,
  rootDir,
  webDir,
} from "./lib/python-runtime.mjs";

const args = process.argv.slice(2);
const productionMode =
  args.includes("--prod") ||
  args.includes("--production") ||
  process.env.CAFE_MODE === "production";

const pythonPath = requirePython();
const nextCliPath = join(webDir, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextCliPath)) {
  console.error("[Cafe] Next.js نصب نشده است. اجرا کنید: cd apps/web && npm install");
  process.exit(1);
}

const apiPort = envInt("API_PORT", 8000);
const webPort = envInt("WEB_PORT", 3000);
// پشت پروکسی معتبر (Caddy/Nginx) سرویس‌ها فقط روی loopback گوش می‌دهند.
const defaultHost = productionMode ? "127.0.0.1" : "0.0.0.0";
const apiHost = process.env.API_HOST ?? defaultHost;
const webHost = process.env.WEB_HOST ?? defaultHost;
const apiInternalUrl = process.env.API_INTERNAL_URL ?? `http://127.0.0.1:${apiPort}`;

if (productionMode && !existsSync(join(webDir, ".next", "BUILD_ID"))) {
  console.error(
    "[Cafe] بیلد تولیدی Next.js پیدا نشد. ابتدا اجرا کنید: npm run build",
  );
  process.exit(1);
}

const sharedEnv = {
  ...process.env,
  ENVIRONMENT: productionMode ? "production" : process.env.ENVIRONMENT ?? "development",
  API_INTERNAL_URL: apiInternalUrl,
};

const apiArgs = ["-m", "uvicorn", "main:app", "--host", apiHost, "--port", String(apiPort)];
if (!productionMode) apiArgs.push("--reload");

const webArgs = [nextCliPath, productionMode ? "start" : "dev", "--hostname", webHost, "--port", String(webPort)];

const api = spawn(pythonPath, apiArgs, {
  cwd: apiDir,
  stdio: "inherit",
  env: sharedEnv,
});

const web = spawn(process.execPath, webArgs, {
  cwd: webDir,
  stdio: "inherit",
  env: sharedEnv,
});

const children = [api, web];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(`[Cafe] اجرای یکی از سرویس‌ها ممکن نشد: ${error.message}`);
    shutdown(1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code) console.error(`[Cafe] یکی از سرویس‌ها با کد ${code} متوقف شد.`);
    if (signal) console.error(`[Cafe] یکی از سرویس‌ها با سیگنال ${signal} متوقف شد.`);
    shutdown(code ?? 1);
  });
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

const modeLabel = productionMode ? "production" : "development";
console.log(`[Cafe] حالت اجرا: ${modeLabel}`);
console.log(`[Cafe] پوشهٔ پروژه: ${rootDir}`);
console.log(`[Cafe] API:  http://${apiHost}:${apiPort}`);
console.log(`[Cafe] Web:  http://${webHost}:${webPort}`);
if (productionMode) {
  console.log("[Cafe] سرویس‌ها فقط روی loopback فعال‌اند؛ ترافیک را از پروکسی عبور دهید.");
} else {
  console.log("[Cafe] برای خروج Ctrl+C را بزنید.");
}
if (isWindows && productionMode) {
  console.log("[Cafe] نکته: در ویندوز اجرای production معمولاً پشت IIS یا یک پروکسی انجام می‌شود.");
}
