import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32"
  ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean)
  : ["docker"];
let docker = "docker";
for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let output = "", error = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => error += chunk);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim())));
    child.stdin.end(input);
  });
}

const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", name]);
if (target !== `/${name}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);
const migrations = [
  ["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql", "select to_regclass('public.learning_commercial_allocations') is not null;"],
  ["20260904000000_add_instructor_earnings_visibility.sql", "select to_regprocedure('public.get_own_learning_instructor_earnings()') is not null;"],
  ["20260905000000_add_instructor_earnings_release_operations.sql", "select to_regclass('public.learning_instructor_earnings_release_runs') is not null;"],
  ["20260907000000_add_instructor_payout_profile_recipient_foundation.sql", "select to_regclass('public.learning_instructor_payout_profiles') is not null;"],
];
for (const [file, probe] of migrations) {
  const exists = await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], probe);
  if (exists.trim() !== "t") await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", file), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "phase1e1_payout_profile.sql"), "utf8"));
console.log("PASS Phase 1E1 payout-profile foundation on isolated local Supabase");
