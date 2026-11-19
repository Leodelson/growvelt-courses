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

const target = "growvelt-learning-production";
const cf = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "cf.cmd" : "cf");

function parseJsonOutput(output) {
  const clean = output.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    for (let start = 0; start < clean.length; start += 1) {
      if (clean[start] !== "{" && clean[start] !== "[") continue;
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let end = start; end < clean.length; end += 1) {
        const char = clean[end];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === "{" || char === "[") depth += 1;
        else if (char === "}" || char === "]") {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(clean.slice(start, end + 1));
            } catch {
              break;
            }
          }
        }
      }
    }
    return undefined;
  }
}

function readCfJson(args, description) {
  const result = spawnSync(cf, [...args, "--quiet"], {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not ${description}; refusing to build a production candidate.`);
  const value = parseJsonOutput(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  if (!value) throw new Error(`Cloudflare returned an unreadable response while trying to ${description}.`);
  return value;
}

function findActiveVersionIds(value) {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value.versions)) {
    const ids = value.versions
      .filter((entry) => Number(entry?.percentage) > 0)
      .map((entry) => entry?.version_id ?? entry?.versionId)
      .filter((id) => typeof id === "string");
    if (ids.length > 0) return ids;
  }
  for (const entry of Array.isArray(value) ? value : Object.values(value)) {
    const found = findActiveVersionIds(entry);
    if (found) return found;
  }
  return undefined;
}

function findBindings(value) {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    if (value.every((entry) => entry && typeof entry.name === "string" && typeof entry.type === "string")) return value;
    for (const entry of value) {
      const found = findBindings(entry);
      if (found) return found;
    }
    return undefined;
  }
  if (Array.isArray(value.bindings)) return value.bindings;
  if (value.bindings && typeof value.bindings === "object") {
    return Object.entries(value.bindings).map(([name, binding]) => ({ name, ...binding }));
  }
  for (const entry of Object.values(value)) {
    const found = findBindings(entry);
    if (found) return found;
  }
  return undefined;
}

const deployments = readCfJson(
  ["workers", "deployments", "list", "--worker", target, "--per-page", "1"],
  "read the active Learning Worker deployment",
);
const activeVersionIds = findActiveVersionIds(deployments);
if (!activeVersionIds?.length) throw new Error("Could not identify the active Learning Worker version; refusing to build a production candidate.");
if (activeVersionIds.length !== 1) throw new Error("Learning production has multiple traffic-serving versions; refusing to build an ambiguous candidate.");

const activeVersion = readCfJson(
  ["workers", "versions", "get", activeVersionIds[0], "--worker-id", target],
  "read active Learning Worker bindings",
);
const activeBindings = findBindings(activeVersion);
if (!activeBindings) throw new Error("Could not read active Learning Worker bindings; refusing to build a production candidate.");

const activePlainTextBindings = activeBindings.filter((binding) => binding.type === "plain_text");
const missingActiveValues = activePlainTextBindings.filter((binding) => typeof binding.text !== "string").map((binding) => binding.name);
if (missingActiveValues.length > 0) {
  throw new Error(`Active Learning variables had no readable values: ${missingActiveValues.join(", ")}. Refusing to build a production candidate.`);
}

const publicValueMismatches = requiredPublicVariables.filter((name) => {
  const activeValue = activePlainTextBindings.find((binding) => binding.name === name)?.text;
  return typeof activeValue !== "string" || process.env[name] !== activeValue;
});
if (publicValueMismatches.length > 0) {
  throw new Error(`Cloudflare build settings do not match active Learning settings: ${publicValueMismatches.join(", ")}. Refusing to build a production candidate.`);
}

const activePlainTextValues = Object.fromEntries(activePlainTextBindings.map(({ name, text }) => [name, text]));
const redactBuildOutput = (output) => {
  let safeOutput = output ?? "";
  for (const value of Object.values(activePlainTextValues)) {
    if (value) safeOutput = safeOutput.split(value).join("[runtime value hidden]");
  }
  return safeOutput.replace(/(env\.[A-Z0-9_]+\s+\()[^)]*(\)\s+Environment Variable)/g, "$1[runtime value hidden]$2");
};

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
Object.assign(env, activePlainTextValues);
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
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.stdout) process.stdout.write(redactBuildOutput(result.stdout));
  if (result.stderr) process.stderr.write(redactBuildOutput(result.stderr));
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(isolatedEnvDir, { recursive: true, force: true });
}
