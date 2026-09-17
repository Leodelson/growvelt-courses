import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const name="supabase_db_growvelt-learning-phase0c-local";
const candidates=process.platform==="win32"?[process.env.DOCKER_PATH,path.join(process.env.LOCALAPPDATA??"","Programs","DockerDesktop","resources","bin","docker.exe")].filter(Boolean):["docker"];
let docker="docker";for(const candidate of candidates){try{if(candidate!=="docker")await access(candidate);docker=candidate;break;}catch{}}
function run(args,input=" "){return new Promise((resolve,reject)=>{const child=spawn(docker,args,{cwd:root,stdio:["pipe","pipe","pipe"],shell:false});let output="",error="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>error+=chunk);child.once("error",reject);child.once("exit",code=>code===0?resolve(output.trim()):reject(new Error((error||output).trim())));child.stdin.end(input);});}
const target=await run(["inspect","--format","{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",name]);
if(target!==`/${name}|running|55432`)throw new Error(`Refusing unexpected database target: ${target}`);
for(const [file,probe] of [["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql","select to_regclass('public.learning_commercial_allocations') is not null;"],["20260904000000_add_instructor_earnings_visibility.sql","select to_regprocedure('public.get_own_learning_instructor_earnings()') is not null;"],["20260905000000_add_instructor_earnings_release_operations.sql","select to_regclass('public.learning_instructor_earnings_release_runs') is not null;"]]){const exists=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],probe);if(exists.trim()!=="t")await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","migrations",file),"utf8"));}
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","tests","phase1c2b_matured_earnings_release.sql"),"utf8"));
// The main SQL test rolls back. This deliberately separate, uniquely named
// local-only fixture lets two database sessions race the actual release wrapper.
const suffix=randomUUID().replaceAll("-","");
const instructorId=randomUUID(); const courseSlug=`phase1c2b-concurrency-${suffix}`;
const setup=`do $fixture$
declare course_key bigint; order_key bigint; capture_key bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values('${instructorId}','authenticated','authenticated','${suffix}@example.test',now(),now());
  insert into public.profiles(id,email,full_name,onboarding_status) values('${instructorId}','${suffix}@example.test','Phase 1C2B Concurrency','complete') on conflict(id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status) values('${instructorId}','Phase 1C2B concurrency fixture','${courseSlug}',100,'NGN',false,false,'draft') returning id into course_key;
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at) values('${instructorId}',course_key,'Phase 1C2B concurrency fixture',10000,'NGN','paid','growvelt-commercial-v1',now()-interval '15 days') returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description) values(order_key,'payment_capture','NGN','Phase 1C2B local concurrency fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values(capture_key,1,'asset.paystack_receivable',10000,'NGN'),(capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  perform public.allocate_learning_order_commercial_terms(order_key,null);
end;$fixture$;
select public.start_learning_instructor_earnings_release_run('scheduler',null);
select public.start_learning_instructor_earnings_release_run('scheduler',null);`;
const runIds=(await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],setup)).split(/\r?\n/).map(Number).filter(Number.isInteger);
if(runIds.length!==2)throw new Error("Unable to create two local concurrent release runs");
const [first,second]=await Promise.all(runIds.map((runId)=>run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],`select public.execute_learning_instructor_earnings_release_run(${runId});`)));
const released=[first,second].map(Number).reduce((total,value)=>total+value,0);
const verify=`select count(*) from public.learning_ledger_transactions transaction join public.learning_orders learning_order on learning_order.id=transaction.order_id join public.learning_courses course on course.id=learning_order.course_id where course.slug='${courseSlug}' and transaction.transaction_type='instructor_earnings_release';`;
if(released!==1 || Number(await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],verify))!==1)throw new Error("Concurrent release invocation created duplicate financial state");
console.log("PASS Phase 1C2B matured instructor earnings release operations on isolated local Supabase");
