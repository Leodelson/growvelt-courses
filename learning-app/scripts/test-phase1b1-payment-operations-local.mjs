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
const migration=await readFile(path.join(root,"supabase","migrations","20260828000000_add_payment_operations_recovery.sql"),"utf8");
let tests=await readFile(path.join(root,"supabase","tests","phase1b1_payment_operations.sql"),"utf8");
const authColumns=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],"select string_agg(column_name,',') from information_schema.columns where table_schema='auth' and table_name='users' and column_name in('email_confirmed_at','confirmed_at','is_anonymous');");
if(!authColumns.includes("email_confirmed_at")) tests=tests.replaceAll("email_confirmed_at","confirmed_at");
if(!authColumns.includes("is_anonymous")){const boundary=tests.indexOf("insert into public.account_capabilities");tests=tests.slice(0,boundary).replace(",is_anonymous)",")").replaceAll(",false)",")")+tests.slice(boundary);}
const phase1b1AlreadyPresent=await run([
  "exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres",
],"select exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_payment_provider_events' and column_name='processing_attempts');");
const setup=phase1b1AlreadyPresent.trim()==="t" ? "" : migration;
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],`begin;\n${setup}\n${tests}\nrollback;`);
console.log(`PASS Phase 1B1 payment recovery tests on isolated local Supabase (${setup ? "migration applied transactionally" : "declarative schema already synchronized"})`);
