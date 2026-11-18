import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
const env = {};
for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "WINDIR", "ComSpec"]) {
  if (process.env[key]) env[key] = process.env[key];
}

Object.assign(env, {
  CI: "true",
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase-fixture.example.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  NEXT_PUBLIC_LEARNING_SITE_URL: "https://growvelt-learning-staging-pilot.late-smoke-33c0.workers.dev",
  NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com",
  NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false",
});

const result = spawnSync(process.execPath, [vite, "build"], {
  cwd: root,
  env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
