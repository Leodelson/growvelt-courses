import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const container = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32"
  ? [
      process.env.DOCKER_PATH,
      path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
      path.join(process.env.ProgramFiles ?? "", "Docker", "Docker", "resources", "bin", "docker.exe"),
    ].filter(Boolean)
  : [process.env.DOCKER_PATH, "docker"].filter(Boolean);

let docker = candidates.at(-1);
for (const candidate of candidates) {
  try {
    if (candidate === "docker") { docker = candidate; break; }
    await access(candidate); docker = candidate; break;
  } catch { /* Try the next known Docker path. */ }
}

function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let out = "", err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve({ code, out: out.trim(), err: err.trim() })
      : reject(Object.assign(new Error((err || out).trim()), { code, out: out.trim(), err: err.trim() })));
    child.stdin.end(input);
  });
}

const target = await run(["inspect", "--format", "{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}", container]);
if (target.out !== `/${container}|running|55432`) throw new Error(`Refusing unexpected database target: ${target.out}`);

const migration = await readFile(path.join(root, "supabase", "migrations", "20260827000000_add_paystack_test_fixture_renewal.sql"), "utf8");
let tests = await readFile(path.join(root, "supabase", "tests", "phase1a_paystack_test_fixture_renewal.sql"), "utf8");
const historyProtection = await readFile(path.join(root, "supabase", "schemas", "public", "functions", "protect_paystack_test_fixture_history.sql"), "utf8");
const renewalFunction = await readFile(path.join(root, "supabase", "schemas", "public", "functions", "renew_paystack_test_fixture.sql"), "utf8");
const psql = ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];

const authColumns = (await run([...psql, "-Atc", "select string_agg(column_name,',') from information_schema.columns where table_schema='auth' and table_name='users' and column_name in('email_confirmed_at','confirmed_at','is_sso_user','is_anonymous');"])).out;
function adaptAuthFixture(value) {
  if (!authColumns.includes("email_confirmed_at")) value = value.replaceAll("email_confirmed_at", "confirmed_at");
  const boundary = value.indexOf("insert into public.instructor_profiles");
  let prefix = boundary < 0 ? value : value.slice(0, boundary);
  const suffix = boundary < 0 ? "" : value.slice(boundary);
  if (!authColumns.includes("is_sso_user") && !authColumns.includes("is_anonymous")) {
    prefix = prefix.replace(/,\s*is_sso_user\s*,\s*is_anonymous/g, "").replace(/,\s*false\s*,\s*false\)/g, ")");
  }
  return prefix + suffix;
}
tests = adaptAuthFixture(tests);

const present = await run([...psql, "-Atc", "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='learning_paystack_test_fixtures' and column_name='previous_fixture_id');"]);
if (present.out !== "t") await run(psql, migration);

await run(psql, `${historyProtection}\n${renewalFunction}`);
await run(psql, tests);

let setup = `
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('13000000-0000-4000-a000-000000000001','authenticated','authenticated','concurrent-tester@fixture.invalid','',now(),'{}','{"full_name":"Concurrent Tester"}',now(),now(),false,false),
('13000000-0000-4000-a000-000000000003','authenticated','authenticated','concurrent-teacher@fixture.invalid','',now(),'{}','{"full_name":"Concurrent Instructor"}',now(),now(),false,false),
('13000000-0000-4000-a000-000000000004','authenticated','authenticated','concurrent-admin@fixture.invalid','',now(),'{}','{"full_name":"Concurrent Admin"}',now(),now(),false,false);
insert into public.instructor_profiles(user_id,headline,bio,approval_status,reviewed_at) values('13000000-0000-4000-a000-000000000003','Concurrent Instructor','Local concurrency instructor','approved',now());
insert into public.account_capabilities(user_id,capability,status) values
('13000000-0000-4000-a000-000000000003','instructor','active'),('13000000-0000-4000-a000-000000000004','admin','active');
insert into public.learning_courses(instructor_id,title,slug,summary,description,level,category,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('13000000-0000-4000-a000-000000000003','[TEST] Concurrent Renewal Course','phase1a-paystack-test-concurrent','A concurrent paid course fixture','A complete local-only course used to test concurrent guarded fixture renewal.','Beginner','Business',false,100,'NGN',false,'published',now()-interval '2 hours');
insert into public.course_modules(course_id,title,position) select id,'Concurrent module',1 from public.learning_courses where slug='phase1a-paystack-test-concurrent';
insert into public.lessons(course_id,module_id,title,lesson_type,content,is_preview,position)
select c.id,m.id,'Concurrent lesson','text','A valid concurrent renewal lesson.',true,1 from public.learning_courses c join public.course_modules m on m.course_id=c.id where c.slug='phase1a-paystack-test-concurrent';
insert into public.course_rights_declarations(course_id,instructor_id,declaration_version,rights_basis,accepted_at)
select id,'13000000-0000-4000-a000-000000000003','2026-08-v1','original',now()-interval '2 hours' from public.learning_courses where slug='phase1a-paystack-test-concurrent';
insert into public.learning_paystack_test_fixtures(course_id,tester_id,status,activated_at,expires_at,activated_by)
select id,'13000000-0000-4000-a000-000000000001','active',now()-interval '2 hours',now()-interval '1 hour','13000000-0000-4000-a000-000000000004' from public.learning_courses where slug='phase1a-paystack-test-concurrent';
`;
setup = adaptAuthFixture(setup);
const cleanup = `
begin;
delete from public.learning_paystack_test_fixtures where previous_fixture_id is not null and course_id=(select id from public.learning_courses where slug='phase1a-paystack-test-concurrent');
delete from public.learning_paystack_test_fixtures where course_id=(select id from public.learning_courses where slug='phase1a-paystack-test-concurrent');
delete from public.course_rights_declarations where course_id=(select id from public.learning_courses where slug='phase1a-paystack-test-concurrent');
delete from public.learning_courses where slug='phase1a-paystack-test-concurrent';
delete from public.account_capabilities where user_id in ('13000000-0000-4000-a000-000000000003','13000000-0000-4000-a000-000000000004');
delete from public.instructor_profiles where user_id='13000000-0000-4000-a000-000000000003';
delete from auth.users where id in ('13000000-0000-4000-a000-000000000001','13000000-0000-4000-a000-000000000003','13000000-0000-4000-a000-000000000004');
commit;`;

try {
  await run(psql, setup);
  const previous = await run([...psql, "-Atc", "select f.id from public.learning_paystack_test_fixtures f join public.learning_courses c on c.id=f.course_id where c.slug='phase1a-paystack-test-concurrent';"]);
  const renewal = `select * from public.renew_paystack_test_fixture(${Number(previous.out)},'13000000-0000-4000-a000-000000000004',now()+interval '2 hours');`;
  const results = await Promise.allSettled([run(psql, renewal), run(psql, renewal)]);
  const succeeded = results.filter((result) => result.status === "fulfilled").length;
  const rejected = results.filter((result) => result.status === "rejected").length;
  if (succeeded !== 1 || rejected !== 1) throw new Error(`Concurrent renewal expected one success and one rejection; got ${succeeded}/${rejected}`);
  const assertion = await run([...psql, "-Atc", `select count(*)||'|'||count(*) filter(where status='active') from public.learning_paystack_test_fixtures where course_id=(select id from public.learning_courses where slug='phase1a-paystack-test-concurrent');`]);
  if (assertion.out !== "2|1") throw new Error(`Unexpected concurrent fixture history: ${assertion.out}`);
} finally {
  await run(psql, cleanup).catch(() => undefined);
}

console.log("PASS guarded fixture renewal, immutable history, isolation, financial blocking, and real two-session concurrency on isolated local Supabase");
