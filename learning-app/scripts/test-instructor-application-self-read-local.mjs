import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker";
for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let output = "", error = ""; child.stdout.on("data", chunk => output += chunk); child.stderr.on("data", chunk => error += chunk); child.once("error", reject); child.once("exit", code => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim()))); child.stdin.end(input); }); }
if ((await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}", name])) !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${name}`);
for (const migration of ["20260923000000_add_own_instructor_application_read.sql", "20260924000000_add_instructor_application_submission_rpc.sql"]) {
  const probe = migration.startsWith("202609240") ? "select to_regprocedure('public.submit_own_instructor_application(text,text,text,text[],smallint,text,text,text,text)') is not null;" : "select to_regprocedure('public.get_own_instructor_application()') is not null;";
  if ((await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres"], probe)) !== "t") await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", migration), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "instructor_application_self_read.sql"), "utf8"));
console.log("PASS secure self-service Instructor application status read on isolated local Supabase");
