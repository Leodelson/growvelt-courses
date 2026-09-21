import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker";
for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let output = ""; let error = ""; child.stdout.on("data", (chunk) => output += chunk); child.stderr.on("data", (chunk) => error += chunk); child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim()))); child.stdin.end(input); }); }
const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}", name]);
if (target !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${target}`);
const probe = await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres"], "select to_regprocedure('public.get_own_learning_provider_organization_insights(bigint)') is not null;");
if (probe !== "t") throw new Error("Apply the Phase 2B4 provider-insights migration to the isolated local Supabase database before running this test.");
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "phase2b4_provider_insights_and_certificate_attribution.sql"), "utf8"));
console.log("PASS Phase 2B4 aggregate provider reporting and certificate attribution on isolated local Supabase");
