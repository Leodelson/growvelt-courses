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
const migration=await readFile(path.join(root,"supabase","migrations","20260902000000_add_paystack_live_domain_foundation.sql"),"utf8");
const exists=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"select to_regprocedure('public.initialize_paystack_live_learning_order(uuid,bigint)') is not null;");
if(exists.trim()!=="t")await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],migration);
else {const validation=migration.slice(migration.indexOf("create or replace function public.validate_learning_provider_event_links"),migration.indexOf("create or replace function public.initialize_paystack_live_learning_order"));const liveFunctions=migration.slice(migration.indexOf("create or replace function public.initialize_paystack_live_learning_order"));await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],validation+liveFunctions);}
const tests=await readFile(path.join(root,"supabase","tests","phase1b3b_live_domain.sql"),"utf8");
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],tests);
console.log("PASS Phase 1B3B live-domain isolation on isolated local Supabase");
