import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const name="supabase_db_growvelt-learning-phase0c-local";
const candidates=process.platform==="win32"?[process.env.DOCKER_PATH,path.join(process.env.LOCALAPPDATA??"","Programs","DockerDesktop","resources","bin","docker.exe"),path.join(process.env.ProgramFiles??"","Docker","Docker","resources","bin","docker.exe")].filter(Boolean):["docker"];
let docker="docker"; for(const candidate of candidates){try{if(candidate!=="docker") await access(candidate);docker=candidate;break;}catch{}}
function run(args,input=""){return new Promise((resolve,reject)=>{const child=spawn(docker,args,{cwd:root,stdio:["pipe","pipe","pipe"],shell:false});let out="",err="";child.stdout.on("data",c=>out+=c);child.stderr.on("data",c=>err+=c);child.once("error",reject);child.once("exit",code=>code===0?resolve(out.trim()):reject(new Error((err||out).trim())));child.stdin.end(input);});}
const target=await run(["inspect","--format","{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",name]);
if(target!==`/${name}|running|55432`) throw new Error(`Refusing unexpected database target: ${target}`);
const migration=await readFile(path.join(root,"supabase","migrations","20260830000000_add_full_refund_foundation.sql"),"utf8");
const tests=await readFile(path.join(root,"supabase","tests","phase1b2a_full_refund.sql"),"utf8");
const present=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"select exists(select 1 from information_schema.tables where table_schema='public' and table_name='learning_payment_case_events');");
if(present.trim()!=="t") await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migration);
else {
  const definitions=`drop function if exists public.list_learning_payment_case_events(uuid,bigint);\n`+["validate_learning_provider_event_links","receive_paystack_test_refund_event","process_paystack_test_refund_event","get_learning_refund_case_for_recovery","list_learning_payment_case_events","reconcile_paystack_test_refunds"].map((functionName)=>{
    const start=migration.indexOf(`create or replace function public.${functionName}`);
    const marker="$function$;"; const end=migration.indexOf(marker,start);
    if(start<0||end<0) throw new Error(`Missing ${functionName} in migration`);
    return migration.slice(start,end+marker.length);
  }).join("\n")+`\ndrop trigger if exists validate_learning_provider_event_links on public.learning_payment_provider_events;
create trigger validate_learning_provider_event_links before insert or update of order_id,payment_attempt_id,payment_case_id on public.learning_payment_provider_events for each row execute function public.validate_learning_provider_event_links();
revoke all on function public.get_learning_refund_case_for_recovery(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_learning_refund_case_for_recovery(uuid,bigint) to postgres,service_role;`;
  await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],definitions);
}
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],tests);
console.log("PASS Phase 1B2A full refund lifecycle on isolated local Supabase");
