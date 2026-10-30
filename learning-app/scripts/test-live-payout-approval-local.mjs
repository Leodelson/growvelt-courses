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
    child.stdout.on("data", chunk => output += chunk);
    child.stderr.on("data", chunk => error += chunk);
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim())));
    child.stdin.end(input);
  });
}
const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", name]);
if (target !== `/${name}|running|55432`) throw new Error(`Refusing unexpected local database target: ${target}`);
const migrations = [
  ["20261114000000_add_instructor_live_payout_profile_setup.sql", "public.create_learning_instructor_paystack_live_payout_profile(uuid,text,text,text,text,text,text,uuid)"],
  ["20261115000000_add_instructor_live_payout_approval.sql", "public.approve_learning_instructor_live_payout_item(bigint,text,uuid)"],
  ["20261116000000_add_instructor_live_payout_event_receipts.sql", "public.receive_paystack_live_transfer_provider_event(text,text,text,text,text,text,text,bigint,text,uuid)"],
  ["20261117000000_add_instructor_live_transfer_submission_gate.sql", "public.begin_learning_instructor_live_transfer(bigint,uuid)"],
  ["20261118000000_add_instructor_live_payout_otp_attempt.sql", "public.begin_learning_instructor_live_otp_finalization(bigint,uuid)"],
];
for (const [file, procedure] of migrations) {
  const exists = await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], `select to_regprocedure('${procedure}') is not null;`);
  if (exists.trim() !== "t") await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", file), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "live_instructor_payout_approval.sql"), "utf8"));
console.log("PASS Live instructor payout approval in isolated local Supabase");
