import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = path.resolve(root, "..", "supabase");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker"; for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let output = "", error = ""; child.stdout.on("data", (chunk) => output += chunk); child.stderr.on("data", (chunk) => error += chunk); child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim()))); child.stdin.end(input); }); }
const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}", name]);
if (target !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${target}`);
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], "drop table if exists public.learning_company_paid_course_purchase_attempts, public.learning_company_paid_course_purchase_seats, public.learning_company_paid_course_purchases cascade;");
for (const filename of ["20260938000000_add_company_paid_course_purchase_foundation.sql", "20260939000000_add_company_paid_course_access_boundary.sql"]) {
  await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(databaseRoot, "migrations", filename), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(databaseRoot, "tests", "phase3c2_company_paid_course_access_boundary.sql"), "utf8"));
console.log("PASS Phase 3C2 company paid-course access boundary on isolated local Supabase");
