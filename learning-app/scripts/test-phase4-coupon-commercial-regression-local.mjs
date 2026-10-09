import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const container = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32"
  ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean)
  : ["docker"];
let docker = "docker";
for (const candidate of candidates) {
  try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch { /* Try the next executable. */ }
}

function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error((stderr || stdout).trim())));
    child.stdin.end(input);
  });
}

const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", container]);
if (target !== `/${container}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);
const present = await run(["exec", "-i", container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c",
  "select to_regclass('public.learning_promotion_coupons') is not null;"]);
if (present !== "f") throw new Error("Refusing rollback-only commercial regression: coupon schema is already present in the shared local database.");
const activeFixtures = await run(["exec", "-i", container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c",
  "select count(*) from public.learning_paystack_test_fixtures where status='active';"]);
if (activeFixtures !== "0") throw new Error("Refusing rollback-only coupon refund regression: the shared local database already has an active Paystack test fixture.");

const migrationFiles = [
  "20261015000000_allow_company_test_mode_courses.sql",
  "20261016000000_add_private_learning_coupon_foundation.sql",
  "20261017000000_integrate_test_coupon_checkout.sql",
];
const migrations = await Promise.all(migrationFiles.map((file) => readFile(path.join(root, "supabase", "migrations", file), "utf8")));
const commercialMigration = await readFile(path.join(root, "supabase", "migrations", "20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql"), "utf8");
const tests = await readFile(path.join(root, "supabase", "tests", "phase1c1_commercial_allocation.sql"), "utf8");
const couponRefundTest = await readFile(path.join(root, "supabase", "tests", "phase4_coupon_full_refund.sql"), "utf8");
const routineNames = [
  "prevent_learning_commercial_terms_mutation", "prevent_learning_commercial_allocation_mutation",
  "prevent_learning_instructor_earning_mutation", "prevent_learning_instructor_earning_event_mutation",
  "resolve_learning_commercial_terms_version", "allocate_learning_order_commercial_terms",
  "release_matured_learning_instructor_earnings", "reverse_learning_order_commercial_allocation",
  "reconcile_learning_commercial_allocations", "initialize_paystack_test_learning_order",
  "finalize_paystack_test_charge", "finalize_paystack_test_full_refund", "finalize_paystack_test_chargeback",
  "initialize_paystack_live_learning_order", "finalize_paystack_live_charge",
];
const currentCommercialRoutines = routineNames.map((functionName) => {
  const start = commercialMigration.indexOf(`create or replace function public.${functionName}`);
  const marker = "$function$;";
  const end = commercialMigration.indexOf(marker, start);
  if (start < 0 || end < 0) throw new Error(`Missing current commercial routine ${functionName}`);
  return commercialMigration.slice(start, end + marker.length);
}).join("\n");
const grantsStart = commercialMigration.lastIndexOf("revoke all on function public.");
const grantsEnd = commercialMigration.indexOf("\n\ncommit;", grantsStart);
if (grantsStart < 0 || grantsEnd < 0) throw new Error("Missing current commercial routine grants");
const transactionalSql = migrations
  .map((sql) => sql.replace(/^\s*begin;\s*$/im, "").replace(/^\s*commit;\s*$/im, ""))
  .join("\n");
const output = await run(["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  `begin;\ndrop function if exists public.release_matured_learning_instructor_earnings(timestamptz,integer,uuid);\n${currentCommercialRoutines}\n${commercialMigration.slice(grantsStart, grantsEnd)}\n${transactionalSql}\n${couponRefundTest}\n${tests}\n`);
if (!/ROLLBACK/i.test(output)) throw new Error(`Commercial regression did not confirm its rollback:\n${output}`);
console.log("PASS Phase 1C commercial allocation/refund/chargeback regressions plus Phase 4 discounted purchase full-refund state machine; all DDL and fixture writes rolled back");
