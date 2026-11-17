/**
 * اجرای یک دستور پایتون در پوشهٔ apps/api با محیط مجازی پروژه.
 *
 * نمونه:
 *   node scripts/run-api-command.mjs -m pytest -q
 *   node scripts/run-api-command.mjs -m app.db.backup_db
 *   node scripts/run-api-command.mjs -m app.db.set_owner_password
 */

import { spawn } from "node:child_process";

import { apiDir, requirePython } from "./lib/python-runtime.mjs";

const pythonArgs = process.argv.slice(2);

if (pythonArgs.length === 0) {
  console.error("[Cafe] هیچ دستوری برای اجرا داده نشد.");
  process.exit(1);
}

const pythonPath = requirePython();
// کنسول پیش‌فرض ویندوز cp1252 است و چاپ پیام‌های فارسی اسکریپت‌ها را
// با UnicodeEncodeError می‌شکند؛ خروجی/ورودی پایتون را UTF-8 می‌کنیم.
const child = spawn(pythonPath, pythonArgs, {
  cwd: apiDir,
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

child.once("error", (error) => {
  console.error(`[Cafe] اجرای دستور ممکن نشد: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code) => {
  process.exit(code ?? 1);
});
