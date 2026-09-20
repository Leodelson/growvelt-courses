import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker";
for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }

function run(args, input = " ") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let output = ""; let error = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => error += chunk);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim())));
    child.stdin.end(input);
  });
}

const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}", name]);
if (target !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${target}`);

const migrations = [
  ["20260823180000_account_deletion_certificate_retention.sql", "select to_regprocedure('public.request_own_learning_account_deletion(text)') is not null;"],
  ["20260919000000_add_training_organization_provider_foundation.sql", "select to_regclass('public.learning_provider_organizations') is not null;"],
  ["20260920000000_add_training_organization_invitation_foundation.sql", "select to_regclass('public.learning_provider_organization_invitations') is not null;"],
  ["20260925000000_add_instructor_notification_delivery_log.sql", "select to_regclass('public.learning_instructor_notifications') is not null;"],
  ["20260927000000_guard_account_deletion_for_organization_records.sql", "select pg_get_functiondef('public.request_own_learning_account_deletion(text)'::regprocedure) like '%organization_offboarding_required%' and not has_table_privilege('authenticated', 'public.learning_account_deletion_requests', 'select');"],
];

for (const [migration, probe] of migrations) {
  if ((await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres"], probe)) !== "t") {
    await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", migration), "utf8"));
  }
}

await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "account_deletion_organization_guard.sql"), "utf8"));
console.log("PASS account deletion organization guard on isolated local Supabase");
