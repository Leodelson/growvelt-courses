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
for(const file of ["20260903000000_add_commercial_allocation_instructor_earnings_foundation.sql","20260904000000_add_instructor_earnings_visibility.sql"]){const sql=await readFile(path.join(root,"supabase","migrations",file),"utf8");const exists=await run(["exec","-i",name,"psql","-X","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],file.startsWith("20260904")?"select to_regprocedure('public.get_own_learning_instructor_earnings()') is not null;":"select to_regclass('public.learning_commercial_allocations') is not null;");if(exists.trim()!=="t")await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],sql);}
const tests=await readFile(path.join(root,"supabase","tests","phase1c2a_instructor_earnings_visibility.sql"),"utf8");
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],tests);
console.log("PASS Phase 1C2A instructor earnings visibility on isolated local Supabase");
