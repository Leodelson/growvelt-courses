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
  try { if (candidate !== "docker") await access(candidate); docker = candidate; break; } catch {}
}

function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve(stdout.trim()) : reject(new Error((stderr || stdout).trim())));
    child.stdin.end(input);
  });
}

const migration = await readFile(path.join(root, "supabase", "migrations", "20260829000000_correct_phase1b1_test_course_slug.sql"), "utf8");
const positiveAssertions = await readFile(path.join(root, "supabase", "tests", "phase1b1_course27_slug_correction.sql"), "utf8");
const instructor = "1fa66aa4-86f4-4e0a-b613-2689c8a7cda0";
const learner = "2b8dbe77-a6a1-44c4-89f4-cb93d5706bb5";
const operator = "3df25e55-b501-480c-b608-8ea51dad6e84";

const setup = `
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('${learner}','authenticated','authenticated','course27-learner@local.invalid','',now(),'{}','{"full_name":"Course 27 Learner"}',now(),now(),false,false),
('${instructor}','authenticated','authenticated','course27-instructor@local.invalid','',now(),'{}','{"full_name":"Course 27 Instructor"}',now(),now(),false,false),
('${operator}','authenticated','authenticated','course27-admin@local.invalid','',now(),'{}','{"full_name":"Course 27 Admin"}',now(),now(),false,false);
insert into public.instructor_profiles(user_id,headline,bio,approval_status,reviewed_at) values
('${instructor}','Course 27 Instructor','Isolated local migration test instructor','approved',now());
insert into public.account_capabilities(user_id,capability,status) values
('${instructor}','instructor','active'),('${operator}','admin','active');
insert into public.learning_courses(id,instructor_id,title,slug,summary,description,level,category,is_free,price_amount,price_currency,is_limited_time_free,status,updated_at)
values(27,'${instructor}','[TEST] Phase 1B1 Abandoned Checkout Recovery','test-phase-1b1-abandoned-checkout-recovery','A valid controlled recovery test course summary','A complete controlled recovery course used only for isolated local slug-correction tests.','Beginner','Productivity',false,100,'NGN',false,'draft',now()-interval '1 hour');
insert into public.course_modules(course_id,title,position) values(27,'Recovery test module',1);
insert into public.lessons(course_id,module_id,title,lesson_type,content,is_preview,position)
select 27,id,'Recovery test lesson','text','Valid local recovery-test lesson content.',false,1 from public.course_modules where course_id=27;
`;

const psql = ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];

async function expectSuccess(name, mutation = "", assertions = "") {
  await run(psql, `${setup}\n${mutation}\n${migration}\n${assertions}\nrollback;`);
  console.log(`PASS ${name}`);
}

async function expectGuard(name, mutation) {
  let message = "";
  try { await run(psql, `${setup}\n${mutation}\n${migration}\nrollback;`); }
  catch (error) { message = error instanceof Error ? error.message : String(error); }
  if (!message.includes("Guarded course 27 slug correction:")) {
    throw new Error(message ? `Scenario failed before the migration guard (${name}): ${message}` : `Guard did not reject scenario: ${name}`);
  }
  console.log(`PASS ${name} rejected atomically`);
}

await expectSuccess("one-time course 27 slug correction and fixture compatibility", "", positiveAssertions);
await expectGuard("submitted course", "update public.learning_courses set submitted_at=now() where id=27;");
await expectGuard("reviewed course", `update public.learning_courses set reviewed_at=now(),reviewed_by='${operator}' where id=27;`);
await expectGuard("published course", "update public.learning_courses set published_at=now() where id=27;");
await expectGuard("wrong title", "update public.learning_courses set title='Unexpected title' where id=27;");
await expectGuard("wrong current slug", "update public.learning_courses set slug='unexpected-course-slug' where id=27;");
await expectGuard("target slug collision", `insert into public.learning_courses(instructor_id,title,slug,status) values('${instructor}','Collision','phase1a-paystack-test-phase1b1-abandoned-checkout-recovery','draft');`);
await expectGuard("inactive instructor", `update public.account_capabilities set status='suspended' where user_id='${instructor}' and capability='instructor';`);
await expectGuard("inactive administrator", `update public.account_capabilities set status='suspended' where user_id='${operator}' and capability='admin';`);
await expectGuard("fixture history", `insert into public.learning_paystack_test_fixtures(course_id,tester_id,expires_at,activated_by) values(27,'${learner}',now()+interval '1 hour','${operator}');`);
await expectGuard("rights history", `insert into public.course_rights_declarations(course_id,instructor_id,declaration_version,rights_basis) values(27,'${instructor}','2026-08-v1','original');`);
await expectGuard("financial history", `insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version) values('${learner}',27,'${instructor}','[TEST] Phase 1B1 Abandoned Checkout Recovery','Course 27 Instructor',10000,'NGN','created','local-test');`);
await expectGuard("entitlement history", `
  insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values('${learner}',27,'${instructor}','[TEST] Phase 1B1 Abandoned Checkout Recovery','Course 27 Instructor',10000,'NGN','paid','local-test',now());
  insert into public.enrollments(learner_id,course_id,status) values('${learner}',27,'active');
  insert into public.learning_course_entitlements(learner_id,course_id,order_id,enrollment_id,status)
  select '${learner}',27,orders.id,enrollment.id,'active' from public.learning_orders orders join public.enrollments enrollment on enrollment.learner_id=orders.learner_id and enrollment.course_id=orders.course_id where orders.course_id=27;
`);
await expectGuard("enrollment history", `insert into public.enrollments(learner_id,course_id,status) values('${learner}',27,'active');`);
console.log("PASS all Course 27 slug-correction guards on isolated local Supabase");
