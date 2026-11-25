import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, symlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";

const status = spawnSync("npx", ["supabase", "status", "--output", "json"], {
  encoding: "utf8",
});
if (status.status !== 0)
  throw new Error("Start the local Supabase stack before browser testing.");
const config = JSON.parse(status.stdout);
const url = config.API_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("Browser tests require a local database.");
const key = config.PUBLISHABLE_KEY ?? config.ANON_KEY;
if (!key) throw new Error("Local public API key unavailable.");
// Isolate generated types/cache from an ordinary development server in this repo.
// Copy source only; never copy .env files, sessions, Git state or generated artifacts.
const sourceRoot = process.cwd();
const appRoot = mkdtempSync(join(tmpdir(), "rebel-move-browser-"));
for (const name of [
  "app",
  "components",
  "lib",
  "public",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
]) {
  const source = join(sourceRoot, name);
  if (existsSync(source))
    cpSync(source, join(appRoot, name), {
      recursive: true,
      filter: (path) => !/ 2(?:\.|$)/.test(basename(path)),
    });
}
symlinkSync(
  join(sourceRoot, "node_modules"),
  join(appRoot, "node_modules"),
  "dir",
);
const options = {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    REBEL_E2E: "1",
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
    // Private key is injected only after the URL is confirmed to be the local stack.
    SUPABASE_SECRET_KEY: config.SERVICE_ROLE_KEY,
    REBEL_WORKER_INVITES_READY: "true",
  },
};
// Test the compiled application, without development-mode refresh/streaming races.
let child = spawn("npx", ["next", "build", "--webpack"], options);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    child.kill(signal);
  });
child.on("exit", (code) => {
  if (stopping || code !== 0) process.exit(code ?? 1);
  child = spawn("npx", ["next", "start", "--port", "3100"], options);
  child.on("exit", (status) => process.exit(status ?? 1));
});
