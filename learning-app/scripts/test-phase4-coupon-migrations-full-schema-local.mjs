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
  try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch { /* Try the next Docker executable. */ }
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
    if (input !== undefined) child.stdin.end(input);
  });
}

const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", container]);
if (target !== `/${container}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);

const existing = await run(["exec", "-i", container, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c",
  "select to_regclass('public.learning_promotion_coupons') is not null;"]);
if (existing.trim() !== "f") throw new Error("Refusing to rerun the DDL rollback check: coupon schema already exists in the isolated database.");

const migrationFiles = [
  // The coupon foundation depends on the company Test Mode restriction added here.
  "20261015000000_allow_company_test_mode_courses.sql",
  "20261016000000_add_private_learning_coupon_foundation.sql",
  "20261017000000_integrate_test_coupon_checkout.sql",
  "20261018000000_require_instructor_owned_coupon_courses.sql",
];
const migrations = await Promise.all(migrationFiles.map((file) => readFile(path.join(root, "supabase", "migrations", file), "utf8")));
const transactionalSql = migrations
  .map((sql) => sql.replace(/^\s*begin;\s*$/im, "").replace(/^\s*commit;\s*$/im, ""))
  .join("\n");
const sql = `begin;\n${transactionalSql}\nselect 'phase4_coupon_schema_ok|' || (
  to_regclass('public.learning_promotion_coupons') is not null
  and to_regclass('public.learning_promotion_redemptions') is not null
  and to_regprocedure('public.is_learning_promotion_course_eligible(bigint)') is not null
  and to_regprocedure('public.initialize_paystack_test_learning_order_with_coupon(uuid,bigint,text,uuid)') is not null
  and to_regprocedure('public.allocate_learning_order_commercial_terms(bigint,uuid)') is not null
)::text;\nrollback;\n`;
const output = await run(["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
if (!output.includes("phase4_coupon_schema_ok|true")) throw new Error(`Full-schema migration check did not confirm the expected objects:\n${output}`);
console.log("PASS Phase 4 coupon migrations apply against the isolated full local schema and roll back cleanly");
