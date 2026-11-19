import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = "growvelt-learning-production";
const cf = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "cf.cmd" : "cf");
const commit = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 8);
const message = commit ? `Learning production candidate ${commit}` : "Learning production candidate";

const upload = spawnSync(
  cf,
  ["workers", "versions", "create", "--prebuilt", "--worker", target, "--message", message],
  {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);

if (upload.stdout) process.stdout.write(upload.stdout);
if (upload.stderr) process.stderr.write(upload.stderr);
if (upload.error) throw upload.error;
if (upload.status !== 0) {
  process.exitCode = upload.status ?? 1;
} else {
  const versionId = upload.stdout.match(/Worker Version ID:\s*([0-9a-f-]{36})/i)?.[1];
  if (!versionId) throw new Error("Candidate upload succeeded but did not report a Worker Version ID.");

  const inspection = spawnSync(cf, ["workers", "versions", "get", versionId, "--worker-id", target], {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  if (inspection.error) throw inspection.error;
  if (inspection.status !== 0) {
    throw new Error("Candidate was uploaded, but Cloudflare could not verify its runtime bindings. It remains inactive.");
  }

  let version;
  try {
    version = JSON.parse(inspection.stdout);
  } catch {
    throw new Error("Candidate was uploaded, but the binding inspection response was not valid JSON. It remains inactive.");
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
    for (const entry of Object.values(value)) {
      const found = findBindings(entry);
      if (found) return found;
    }
    return undefined;
  }

  const bindings = findBindings(version);
  if (!bindings) throw new Error("Candidate was uploaded, but Cloudflare returned no runtime binding list. It remains inactive.");

  const requiredSecrets = [
    "LEARNING_FORWARDING_TOKEN",
    "PAYSTACK_LIVE_SECRET_KEY",
    "RESEND_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TURNSTILE_SECRET_KEY",
  ];
  const missingAssets = !bindings.some((binding) => binding.name === "ASSETS" && binding.type === "assets");
  const missingSecrets = requiredSecrets.filter((name) => !bindings.some((binding) => binding.name === name));
  const incorrectlyTypedSecrets = requiredSecrets.filter((name) => {
    const binding = bindings.find((entry) => entry.name === name);
    return binding && !/secret/i.test(binding.type);
  });
  const bindingSummary = bindings.map(({ name, type }) => ({ name, type }));
  process.stdout.write(`Candidate binding summary (values omitted): ${JSON.stringify(bindingSummary)}\n`);

  if (missingAssets) {
    throw new Error("Candidate is missing the ASSETS binding. It remains inactive.");
  }
  if (missingSecrets.length > 0) {
    throw new Error(`Candidate is missing required secret bindings: ${missingSecrets.join(", ")}. It remains inactive.`);
  }
  if (incorrectlyTypedSecrets.length > 0) {
    throw new Error(`Candidate secret bindings have a non-secret type: ${incorrectlyTypedSecrets.join(", ")}. It remains inactive.`);
  }
}
