import { access, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = ["supabase_db_growvelt-learning-phase0c-local", "supabase_db_learning-app"];
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker = "docker"; for (const candidate of candidates) { try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {} }
function run(args, input = " ") { return new Promise((resolve, reject) => { const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false }); let out="", err=""; child.stdout.on("data", x=>out+=x); child.stderr.on("data", x=>err+=x); child.once("error",reject); child.once("exit",code=>code===0?resolve(out.trim()):reject(new Error((err||out).trim()))); child.stdin.end(input); }); }
let name;
for (const candidate of names) {
  try {
    const target = await run(["inspect","--format","{{.Name}}|{{.State.Status}}",candidate]);
    if (target === `/${candidate}|running`) { name = candidate; break; }
  } catch {}
}
if (!name) throw new Error(`Refusing to run: no expected local Supabase database is running (${names.join(", ")})`);
let databaseReady = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    await run(["exec","-i",name,"psql","-X","-A","-t","-U","postgres","-d","postgres"], "select 1;");
    databaseReady = true;
    break;
  } catch {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
if (!databaseReady) throw new Error(`Refusing to run: local Supabase database ${name} did not become ready within 30 seconds`);
const hasBaseline = await run(["exec","-i",name,"psql","-X","-A","-t","-U","postgres","-d","postgres"], "select to_regclass('public.profiles') is not null;");
if (hasBaseline.trim() !== "t") {
  const baselineMigrations = path.join(os.tmpdir(), "growvelt-learning-phase0c-local", "supabase", "migrations");
  const files = (await readdir(baselineMigrations)).filter(file => file.endsWith(".sql")).sort();
  if (!files.some(file => file.endsWith("_phase0c_local_baseline.sql"))) throw new Error("Refusing to run: prepared local baseline migration is missing");
  for (const file of files) await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(baselineMigrations, file), "utf8"));
}
const migrations = [["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql","learning_commercial_allocations"],["20260907000000_add_instructor_payout_profile_recipient_foundation.sql","learning_instructor_payout_profiles"],["20260908000000_add_instructor_earnings_reservation_foundation.sql","learning_instructor_earning_reservations"],["20260909000000_add_instructor_payout_test_transfer_foundation.sql","learning_instructor_payout_items"],["20260910000000_add_instructor_payout_transfer_reconciliation.sql","learning_instructor_payout_provider_events"],["20260911000000_fix_test_payout_profile_domain_qualification.sql","learning_instructor_payout_profiles"]];
for (const [file, table] of migrations) { const exists = await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], `select to_regclass('public.${table}') is not null;`); if (exists.trim() !== "t") await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations",file),"utf8")); }
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260911000000_fix_test_payout_profile_domain_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260912000000_fix_earnings_reservation_column_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260913000000_fix_earnings_reservation_status_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260914000000_fix_payout_approval_profile_status_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260915000000_fix_payout_provider_event_receipt_conflict_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260916000000_fix_payout_processor_settlement_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260917000000_fix_payout_provider_receipt_lookup_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"], await readFile(path.join(root,"supabase","migrations","20260918000000_fix_reconciliation_finding_event_conflict_qualification.sql"), "utf8"));
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","tests","phase1e4_payout_transfer_reconciliation.sql"),"utf8"));
console.log("PASS Phase 1E4 payout transfer reconciliation on isolated local Supabase");
