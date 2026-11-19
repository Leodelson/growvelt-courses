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
  const uploadOutput = `${upload.stdout ?? ""}\n${upload.stderr ?? ""}`.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
  const versionId = uploadOutput.match(/Worker Version ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
  if (!versionId) throw new Error("Candidate upload succeeded but did not report a Worker Version ID.");

  function parseJsonOutput(output) {
    const clean = output.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      // Some CLI versions add status text around the API response. Extract a
      // balanced JSON value without printing or logging its contents.
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

  function runCfJson(args, description) {
    const result = spawnSync(cf, [...args, "--quiet"], {
      cwd: root,
      env: process.env,
      shell: process.platform === "win32",
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Candidate was uploaded, but Cloudflare could not ${description}. It remains inactive.`);
    }
    const parsed = parseJsonOutput(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (!parsed) throw new Error(`Candidate was uploaded, but Cloudflare returned an unreadable response while trying to ${description}. It remains inactive.`);
    return parsed;
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

  const deployments = runCfJson(
    ["workers", "deployments", "list", "--worker", target, "--per-page", "1"],
    "read the currently active deployment",
  );
  const activeVersionIds = findActiveVersionIds(deployments);
  if (!activeVersionIds?.length) throw new Error("Candidate was uploaded, but the active deployment version could not be identified. It remains inactive.");

  const candidate = runCfJson(["workers", "versions", "get", versionId, "--worker-id", target], "inspect candidate bindings");
  const bindings = findBindings(candidate);
  if (!bindings) throw new Error("Candidate was uploaded, but Cloudflare returned no candidate binding list. It remains inactive.");

  const canonicalValue = (value) => {
    if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const candidateMap = new Map(bindings.map((binding) => [binding.name, binding]));
  const bindingDiffs = [];
  for (const activeVersionId of activeVersionIds) {
    const active = runCfJson(["workers", "versions", "get", activeVersionId, "--worker-id", target], "inspect active bindings");
    const activeBindings = findBindings(active);
    if (!activeBindings) throw new Error("Candidate was uploaded, but Cloudflare returned no binding list for an active version. It remains inactive.");
    const activeMap = new Map(activeBindings.map((binding) => [binding.name, binding]));
    const missing = [...activeMap.keys()].filter((name) => !candidateMap.has(name));
    const added = [...candidateMap.keys()].filter((name) => !activeMap.has(name));
    const changedTypes = [...activeMap.keys()].filter((name) => candidateMap.has(name) && candidateMap.get(name).type !== activeMap.get(name).type);
    const changedPlainBindings = [...activeMap.keys()].filter((name) => {
      const candidateBinding = candidateMap.get(name);
      const activeBinding = activeMap.get(name);
      if (!candidateBinding || !activeBinding || name === "ASSETS" || /secret/i.test(String(activeBinding.type))) return false;
      return canonicalValue(candidateBinding) !== canonicalValue(activeBinding);
    });
    bindingDiffs.push({ activeVersionId, activeCount: activeBindings.length, missing, added, changedTypes, changedPlainBindings });
  }

  const requiredSecrets = [
    "LEARNING_FORWARDING_TOKEN",
    "PAYSTACK_LIVE_SECRET_KEY",
    "RESEND_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TURNSTILE_SECRET_KEY",
  ];
  const missingAssets = !candidateMap.has("ASSETS") || candidateMap.get("ASSETS").type !== "assets";
  const missingSecrets = requiredSecrets.filter((name) => !bindings.some((binding) => binding.name === name));
  const incorrectlyTypedSecrets = requiredSecrets.filter((name) => {
    const binding = bindings.find((entry) => entry.name === name);
    return binding && !/secret/i.test(binding.type);
  });
  const bindingSummary = bindings.map(({ name, type }) => ({ name, type }));
  process.stdout.write(`Candidate binding summary (values omitted): ${JSON.stringify(bindingSummary)}\n`);
  process.stdout.write(`Active/candidate binding comparison (values omitted): ${JSON.stringify({ candidateCount: bindings.length, activeVersions: bindingDiffs })}\n`);

  if (missingAssets) {
    throw new Error("Candidate is missing the ASSETS binding. It remains inactive.");
  }
  if (bindingDiffs.some((diff) => diff.missing.length || diff.added.length || diff.changedTypes.length || diff.changedPlainBindings.length)) {
    throw new Error("Candidate runtime bindings differ from the active production version. It remains inactive.");
  }
  if (missingSecrets.length > 0) {
    throw new Error(`Candidate is missing required secret bindings: ${missingSecrets.join(", ")}. It remains inactive.`);
  }
  if (incorrectlyTypedSecrets.length > 0) {
    throw new Error(`Candidate secret bindings have a non-secret type: ${incorrectlyTypedSecrets.join(", ")}. It remains inactive.`);
  }
}
