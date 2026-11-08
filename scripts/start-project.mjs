import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptsDir);
const apiDir = join(rootDir, "apps", "api");
const webDir = join(rootDir, "apps", "web");
const isWindows = process.platform === "win32";

const pythonCandidates = isWindows
  ? [
      join(apiDir, ".venv", "Scripts", "python.exe"),
      join(rootDir, ".venv", "Scripts", "python.exe"),
    ]
  : [
      join(apiDir, ".venv", "bin", "python"),
      join(rootDir, ".venv", "bin", "python"),
    ];
const pythonPath = pythonCandidates.find((candidate) => existsSync(candidate));
const nextCliPath = join(webDir, "node_modules", "next", "dist", "bin", "next");

if (!pythonPath) {
  console.error(
    "[Cafe] Python virtual environment not found. Create apps/api/.venv and install apps/api/requirements.txt first.",
  );
  process.exit(1);
}

if (!existsSync(nextCliPath)) {
  console.error("[Cafe] Next.js is not installed. Run: cd apps/web && npm install");
  process.exit(1);
}

const api = spawn(
  pythonPath,
  ["-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
  { cwd: apiDir, stdio: "inherit" },
);
const web = spawn(
  process.execPath,
  [nextCliPath, "dev", "--hostname", "0.0.0.0", "--port", "3000"],
  { cwd: webDir, stdio: "inherit" },
);
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
    console.error(`[Cafe] Could not start a server: ${error.message}`);
    shutdown(1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code) console.error(`[Cafe] A server stopped with exit code ${code}.`);
    if (signal) console.error(`[Cafe] A server stopped by ${signal}.`);
    shutdown(code ?? 1);
  });
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

console.log("[Cafe] API:  http://localhost:8000");
console.log("[Cafe] Web:  http://localhost:3000");
console.log("[Cafe] Press Ctrl+C to stop both servers.");
