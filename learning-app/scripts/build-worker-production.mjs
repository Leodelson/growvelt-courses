import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
const requiredPublicVariables = [
  "NEXT_PUBLIC_CAREERS_SITE_URL",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED",
  "NEXT_PUBLIC_LEARNING_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];
const missing = requiredPublicVariables.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  throw new Error(`Missing required production build variables: ${missing.join(", ")}`);
}

const env = {};
for (const key of [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "SystemDrive",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
]) {
  if (process.env[key]) env[key] = process.env[key];
}

for (const key of requiredPublicVariables) env[key] = process.env[key];
Object.assign(env, {
  CI: "true",
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  GROWVELT_CLOUDFLARE_BUILD_ENV_DIR: "",
});

const isolatedEnvDir = mkdtempSync(path.join(os.tmpdir(), "growvelt-learning-production-build-"));
env.GROWVELT_CLOUDFLARE_BUILD_ENV_DIR = isolatedEnvDir;

try {
  const result = spawnSync(process.execPath, [vite, "build"], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(isolatedEnvDir, { recursive: true, force: true });
}
