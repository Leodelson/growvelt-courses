import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => error += chunk);
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error((error || output).trim())));
    child.stdin.end(input);
  });
}
const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", name]);
if (target !== `/${name}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);
const migrations = [
  ["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql", "select to_regclass('public.learning_commercial_allocations') is not null;"],
  ["20260907000000_add_instructor_payout_profile_recipient_foundation.sql", "select to_regprocedure('public.assert_learning_approved_instructor(uuid)') is not null;"],
  ["20260908000000_add_instructor_earnings_reservation_foundation.sql", "select to_regclass('public.learning_instructor_earning_reservations') is not null;"],
];
for (const [file, probe] of migrations) {
  const exists = await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], probe);
  if (exists.trim() !== "t") await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "migrations", file), "utf8"));
}
await run(["exec", "-i", name, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], await readFile(path.join(root, "supabase", "tests", "phase1e2_earnings_reservation.sql"), "utf8"));

// A committed, uniquely named local-only fixture lets two independent database
// sessions race the same real reservation RPC. The shared idempotency key must
// yield one durable reservation and no additional economic ledger entry.
const suffix = randomUUID().replaceAll("-", "");
const adminId = randomUUID();
const instructorId = randomUUID();
const courseSlug = `phase1e2-concurrency-${suffix}`;
const setup = `do $fixture$
declare course_key bigint; order_key bigint; capture_key bigint; allocation_key bigint; earning_key bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    ('${adminId}','authenticated','authenticated','${suffix}-admin@example.test',now(),now()),
    ('${instructorId}','authenticated','authenticated','${suffix}-instructor@example.test',now(),now());
  insert into public.profiles(id,email,full_name,onboarding_status) values
    ('${adminId}','${suffix}-admin@example.test','Phase 1E2 Concurrency Admin','complete'),
    ('${instructorId}','${suffix}-instructor@example.test','Phase 1E2 Concurrency Instructor','complete');
  insert into public.account_capabilities(user_id,capability,status) values
    ('${adminId}','admin','active'),('${instructorId}','instructor','active');
  insert into public.instructor_profiles(user_id,approval_status) values('${instructorId}','approved');
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values('${instructorId}','Phase 1E2 concurrency fixture','${courseSlug}',100,'NGN',false,false,'draft') returning id into course_key;
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values('${instructorId}',course_key,'Phase 1E2 concurrency fixture',10000,'NGN','paid','growvelt-commercial-v1',now()-interval '15 days') returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1E2 local concurrency fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select id into earning_key from public.learning_instructor_earnings where allocation_id=allocation_key and status='available';
  if earning_key is null then raise exception 'Unable to prepare available concurrency earning'; end if;
end;$fixture$;
select earning.id from public.learning_instructor_earnings earning
join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
join public.learning_orders learning_order on learning_order.id=allocation.order_id
join public.learning_courses course on course.id=learning_order.course_id
where course.slug='${courseSlug}';`;
const earningId = Number(await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], setup));
if (!Number.isInteger(earningId)) throw new Error("Unable to prepare the Phase 1E2 concurrent reservation fixture");
const idempotencyKey = `phase1e2:concurrent:${suffix}`;
const reservationQuery = `select reservation_id from public.reserve_learning_instructor_earning(${earningId},'${instructorId}','${idempotencyKey}','${adminId}');`;
const [first, second] = await Promise.all([
  run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], reservationQuery),
  run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], reservationQuery),
]);
if (!/^\d+$/.test(first) || first !== second) throw new Error("Concurrent idempotent reservation did not return the same reservation identity");
const verify = `select count(*)||'|'||(select status from public.learning_instructor_earnings where id=${earningId})||'|'||(select count(*) from public.learning_instructor_earning_events where earning_id=${earningId} and event_type='earning.reserved')||'|'||(select count(*) from public.learning_ledger_transactions transaction join public.learning_commercial_allocations allocation on allocation.order_id=transaction.order_id where allocation.id=(select allocation_id from public.learning_instructor_earnings where id=${earningId}));`;
const [reservationCount, status, eventCount, ledgerCount] = (await run(["exec", "-i", name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], verify)).split("|");
if (reservationCount !== "1" || status !== "reserved" || eventCount !== "1" || ledgerCount !== "3") {
  throw new Error("Concurrent reservation created duplicate state or an unintended ledger movement");
}
console.log("PASS Phase 1E2 earnings reservation foundation on isolated local Supabase");
