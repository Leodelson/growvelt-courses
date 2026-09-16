import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const name="supabase_db_growvelt-learning-phase0c-local";
const candidates=process.platform==="win32"?[process.env.DOCKER_PATH,path.join(process.env.LOCALAPPDATA??"","Programs","DockerDesktop","resources","bin","docker.exe")].filter(Boolean):["docker"];
let docker="docker";for(const candidate of candidates){try{if(candidate!=="docker")await access(candidate);docker=candidate;break;}catch{}}
function run(args,input=" "){return new Promise((resolve,reject)=>{const child=spawn(docker,args,{cwd:root,stdio:["pipe","pipe","pipe"],shell:false});let output="",error="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>error+=chunk);child.once("error",reject);child.once("exit",code=>code===0?resolve(output.trim()):reject(new Error((error||output).trim())));child.stdin.end(input);});}
const target=await run(["inspect","--format","{{.Name}}|{{.State.Status}}|{{(index (index .NetworkSettings.Ports \"5432/tcp\") 0).HostPort}}",name]);
if(target!==`/${name}|running|55432`)throw new Error(`Refusing unexpected database target: ${target}`);
const migration=await readFile(path.join(root,"supabase","migrations","20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql"),"utf8");
const exists=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"select to_regclass('public.learning_commercial_allocations') is not null;");
if(exists.trim()!=="t")await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migration);
else {
  // The shared isolated database may already contain the original local C1
  // migration. Refresh only its replaceable routines, not unrelated schema or
  // data, so this runner exercises the current working-tree implementation.
  await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"drop function if exists public.release_matured_learning_instructor_earnings(timestamptz,integer,uuid);");
  for(const functionName of ["prevent_learning_commercial_terms_mutation","prevent_learning_commercial_allocation_mutation","prevent_learning_instructor_earning_mutation","prevent_learning_instructor_earning_event_mutation","resolve_learning_commercial_terms_version","allocate_learning_order_commercial_terms","release_matured_learning_instructor_earnings","reverse_learning_order_commercial_allocation","reconcile_learning_commercial_allocations","initialize_paystack_test_learning_order","finalize_paystack_test_charge","finalize_paystack_test_full_refund","finalize_paystack_test_chargeback","initialize_paystack_live_learning_order","finalize_paystack_live_charge"]){const start=migration.indexOf(`create or replace function public.${functionName}`),marker="$function$;",end=migration.indexOf(marker,start);if(start<0||end<0)throw new Error(`Missing ${functionName}`);await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migration.slice(start,end+marker.length));}
  const grantsStart=migration.lastIndexOf("revoke all on function public.");
  const grantsEnd=migration.indexOf("\n\ncommit;",grantsStart);
  if(grantsStart<0||grantsEnd<0)throw new Error("Missing Phase 1C1 routine grants");
  await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migration.slice(grantsStart,grantsEnd));
}
const tests=await readFile(path.join(root,"supabase","tests","phase1c1_commercial_allocation.sql"),"utf8");
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],tests);
console.log("PASS Phase 1C1 commercial allocation on isolated local Supabase");
