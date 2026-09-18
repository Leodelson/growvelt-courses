import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker"; for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let out="", err=""; child.stdout.on("data", x=>out+=x); child.stderr.on("data", x=>err+=x); child.once("error",reject); child.once("exit",code=>code===0?resolve(out.trim()):reject(new Error((err||out).trim()))); child.stdin.end(input); }); }
const target = await run(["inspect","--format","{{.Name}}|{{.State.Status}}",name]);
if (target !== `/${name}|running`) throw new Error(`Refusing unexpected database target: ${target}`);
const migrations = [["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql","learning_commercial_allocations"],["20260907000000_add_instructor_payout_profile_recipient_foundation.sql","learning_instructor_payout_profiles"],["20260908000000_add_instructor_earnings_reservation_foundation.sql","learning_instructor_earning_reservations"],["20260909000000_add_instructor_payout_test_transfer_foundation.sql","learning_instructor_payout_items"]];
for (const [file, table] of migrations) { const exists = await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], `select to_regclass('public.${table}') is not null;`); if (exists.trim() !== "t") await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations",file),"utf8")); }
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","tests","phase1e3_payout_test_transfer.sql"),"utf8"));
console.log("PASS Phase 1E3 Test payout transfer foundation on isolated local Supabase");
