import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const container="supabase_db_growvelt-learning-phase0c-local";
const candidates=process.platform==="win32"?[process.env.DOCKER_PATH,path.join(process.env.LOCALAPPDATA??"","Programs","DockerDesktop","resources","bin","docker.exe"),path.join(process.env.ProgramFiles??"","Docker","Docker","resources","bin","docker.exe")].filter(Boolean):[process.env.DOCKER_PATH,"docker"].filter(Boolean);
let docker=candidates.at(-1); for(const candidate of candidates){try{if(candidate==="docker"){docker=candidate;break;}await access(candidate);docker=candidate;break;}catch{}}
function run(args,input=""){return new Promise((resolve,reject)=>{const child=spawn(docker,args,{cwd:root,stdio:["pipe","pipe","pipe"],shell:false});let out="",err="";child.stdout.on("data",c=>out+=c);child.stderr.on("data",c=>err+=c);child.once("error",reject);child.once("exit",code=>code===0?resolve(out.trim()):reject(new Error((err||out).trim())));child.stdin.end(input);});}
const target=await run(["inspect","--format","{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",container]);
if(target!==`/${container}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);
const migration=await readFile(path.join(root,"supabase","migrations","20260826000000_add_paystack_test_fixture_control.sql"),"utf8");
let tests=await readFile(path.join(root,"supabase","tests","phase1a_paystack_test_fixture.sql"),"utf8");
let checkoutTests=await readFile(path.join(root,"supabase","tests","phase1a_paystack_test_checkout.sql"),"utf8");
const authColumns=await run(["exec","-i",container,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"select string_agg(column_name,',') from information_schema.columns where table_schema='auth' and table_name='users' and column_name in('email_confirmed_at','confirmed_at','is_sso_user','is_anonymous');");
function adaptAuthFixture(value){if(!authColumns.includes("email_confirmed_at")) value=value.replaceAll("email_confirmed_at","confirmed_at");const boundary=value.indexOf("insert into public.instructor_profiles");let prefix=boundary<0?value:value.slice(0,boundary);const suffix=boundary<0?"":value.slice(boundary);if(!authColumns.includes("is_sso_user")&&!authColumns.includes("is_anonymous")){prefix=prefix.replace(/,\s*is_sso_user\s*,\s*is_anonymous/g,"").replace(/,\s*false\s*,\s*false\)/g,")");}else if(!authColumns.includes("is_sso_user")){prefix=prefix.replace(/,\s*is_sso_user/g,"").replace(/,\s*false\s*,\s*(false\))/g,", $1");}else if(!authColumns.includes("is_anonymous")){prefix=prefix.replace(/,\s*is_anonymous/g,"").replace(/,\s*false\)/g,")");}return prefix+suffix;}
tests=adaptAuthFixture(tests); checkoutTests=adaptAuthFixture(checkoutTests);
const activation=await readFile(path.join(root,"supabase","schemas","public","functions","activate_paystack_test_fixture.sql"),"utf8");
const closure=await readFile(path.join(root,"supabase","schemas","public","functions","close_paystack_test_fixture.sql"),"utf8");
const detail=await readFile(path.join(root,"supabase","schemas","public","functions","get_published_learning_course_by_slug.sql"),"utf8");
const migrationValidation=`
begin;
drop function if exists public.activate_paystack_test_fixture(bigint,uuid,uuid,timestamptz,text,text);
drop function if exists public.close_paystack_test_fixture(bigint,uuid,text);
drop function if exists public.get_own_paystack_test_fixture_eligibility(bigint);
drop function if exists public.is_paystack_test_fixture_course(bigint) cascade;
drop table if exists public.learning_paystack_test_fixtures cascade;
drop policy if exists "Published courses are public" on public.learning_courses;
create policy "Published courses are public" on public.learning_courses for select to anon,authenticated using(status='published');
drop policy if exists "Published course modules are public" on public.course_modules;
create policy "Published course modules are public" on public.course_modules for select to anon,authenticated using(exists(select 1 from public.learning_courses where learning_courses.id=course_modules.course_id and learning_courses.status='published'));
drop policy if exists "Published course preview lessons are public" on public.lessons;
create policy "Published course preview lessons are public" on public.lessons for select to anon,authenticated using(is_preview=true and exists(select 1 from public.learning_courses where learning_courses.id=lessons.course_id and learning_courses.status='published'));
${migration}
do $assertions$ begin
  if has_function_privilege('authenticated','public.activate_paystack_test_fixture(bigint,uuid,uuid,timestamptz,text,text)','execute') then raise exception 'Unsafe activation grant'; end if;
  if not has_function_privilege('service_role','public.activate_paystack_test_fixture(bigint,uuid,uuid,timestamptz,text,text)','execute') then raise exception 'Missing service activation grant'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='learning_paystack_test_fixtures_one_active_key') then raise exception 'Missing one-active-fixture constraint'; end if;
end $assertions$;
rollback;`;
await run(["exec","-i",container,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migrationValidation);
await run(["exec","-i",container,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],`${activation}\n${closure}\n${detail}\n${tests}`);
await run(["exec","-i",container,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],checkoutTests);
console.log("PASS exact fixture migration, multi-user controls, and existing Paystack database regressions on isolated local Supabase");
