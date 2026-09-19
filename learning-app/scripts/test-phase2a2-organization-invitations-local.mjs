import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const name = "supabase_db_growvelt-learning-phase0c-local";
const candidates = process.platform === "win32" ? [process.env.DOCKER_PATH, path.join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin", "docker.exe")].filter(Boolean) : ["docker"];
let docker="docker"; for (const candidate of candidates) { try { if(candidate!=="docker") await access(candidate); docker=candidate; break; } catch {} }
function run(args,input=" ") { return new Promise((resolve,reject)=>{ const child=spawn(docker,args,{cwd:root,stdio:["pipe","pipe","pipe"],shell:false}); let output="",error=""; child.stdout.on("data",c=>output+=c);child.stderr.on("data",c=>error+=c);child.once("error",reject);child.once("exit",code=>code===0?resolve(output.trim()):reject(new Error((error||output).trim())));child.stdin.end(input);});}
const target=await run(["inspect","--format","{{.Name}}|{{.State.Status}}",name]); if(target!==`/${name}|running`) throw new Error(`Refusing unexpected database target: ${target}`);
for (const [migration,probe] of [["20260919000000_add_training_organization_provider_foundation.sql","select to_regclass('public.learning_provider_organizations') is not null;"],["20260920000000_add_training_organization_invitation_foundation.sql","select to_regclass('public.learning_provider_organization_invitations') is not null;"]]) {
  if ((await run(["exec","-i",name,"psql","-X","-A","-t","-U","postgres","-d","postgres"],probe))!=="t") await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","migrations",migration),"utf8"));
}
await run(["exec","-i",name,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],await readFile(path.join(root,"supabase","tests","phase2a2_training_organization_invitations.sql"),"utf8"));
console.log("PASS Phase 2A2 training-organization invitations on isolated local Supabase");
