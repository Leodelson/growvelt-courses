import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker";
for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let output = "", error = ""; child.stdout.on("data", c => output += c); child.stderr.on("data", c => error += c); child.once("error", reject); child.once("exit", code => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim()))); child.stdin.end(input); }); }
if ((await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}", name])) !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${name}`);
for (const migration of ["20260919000000_add_training_organization_provider_foundation.sql", "20260920000000_add_training_organization_invitation_foundation.sql", "20260921000000_add_training_organization_course_attribution.sql", "20260922000000_add_training_organization_management_visibility.sql"]) {
  const probe = migration.startsWith("202609220") ? "select to_regprocedure('public.list_own_learning_provider_organization_members(bigint)') is not null;" : migration.startsWith("202609210") ? "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='learning_courses' and column_name='organization_id');" : migration.startsWith("202609200") ? "select to_regclass('public.learning_provider_organization_invitations') is not null;" : "select to_regclass('public.learning_provider_organizations') is not null;";
  if ((await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres"], probe)) !== "t") await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", migration), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "phase2a3_training_organization_course_attribution.sql"), "utf8"));
console.log("PASS Phase 2A3 organization course attribution on isolated local Supabase");
