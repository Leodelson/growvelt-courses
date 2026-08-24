import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = "supabase_db_growvelt-learning-phase0c-local";
const dockerCandidates = process.platform === "win32"
  ? [
      process.env.DOCKER_PATH,
      path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
      path.join(process.env.ProgramFiles ?? "", "Docker", "Docker", "resources", "bin", "docker.exe"),
    ].filter(Boolean)
  : [process.env.DOCKER_PATH, "docker"].filter(Boolean);

let docker = dockerCandidates.at(-1);
for (const candidate of dockerCandidates) {
  try {
    if (candidate === "docker") {
      docker = candidate;
      break;
    }
    await access(candidate);
    docker = candidate;
    break;
  } catch {
    // Try the next known Docker installation path.
  }
}

function runDocker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error((stderr || stdout).trim())));
    child.stdin.end(input);
  });
}

const target = await runDocker([
  "inspect",
  "--format",
  "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",
  containerName,
], "");
if (target !== `/${containerName}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);

const migration = await readFile(
  path.join(repositoryRoot, "supabase", "migrations", "20260825000000_add_paystack_test_checkout_foundation.sql"),
  "utf8",
);
const sql = `
begin;
drop function if exists public.initialize_paystack_test_learning_order(uuid,bigint);
drop function if exists public.mark_paystack_test_learning_attempt_pending(text);
drop function if exists public.fail_paystack_test_learning_attempt(text,text,text);
drop function if exists public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb);
drop function if exists public.get_own_paystack_learning_payment_status(text);
drop function if exists public.reconcile_paystack_test_learning_payments();
drop index if exists public.learning_payment_attempts_provider_transaction_key;
drop index if exists public.learning_orders_one_active_purchase_key;
drop index if exists public.learning_ledger_one_capture_per_order_key;
alter table public.learning_payment_attempts drop column if exists provider_transaction_id;
${migration}
do $assertions$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='learning_payment_attempts' and column_name='provider_transaction_id'
  ) then raise exception 'Migration did not add provider transaction ID'; end if;
  if not has_function_privilege('service_role','public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb)','EXECUTE')
  then raise exception 'Migration function grants are unsafe'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='learning_orders_one_active_purchase_key')
  then raise exception 'Migration did not create active-order idempotency index'; end if;
end
$assertions$;
rollback;
`;

await runDocker(
  ["exec", "-i", containerName, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  sql,
);
console.log("PASS exact Phase 1A forward migration applies transactionally to the isolated local baseline");
