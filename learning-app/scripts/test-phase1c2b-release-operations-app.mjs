import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>readFile(path.join(root,file),"utf8");
const [scheduler,admin,operation,cron]=await Promise.all([
  read("app/api/internal/commercial/release-matured/route.ts"),read("app/api/admin/commercial/release-matured/route.ts"),read("app/lib/admin/instructor-earnings-release.ts"),read("vercel.json")
]);
for(const [name,source,needles] of [["scheduler",scheduler,["export async function GET","process.env.CRON_SECRET","timingSafeEqual","runMaturedInstructorEarningsRelease(\"scheduler\", null)"]],["admin",admin,["export async function POST","isSameOriginRequest","is_growvelt_learning_admin","runMaturedInstructorEarningsRelease(\"admin_recovery\", user.id)"]],["operation",operation,["start_learning_instructor_earnings_release_run","execute_learning_instructor_earnings_release_run","fail_learning_instructor_earnings_release_run","const RELEASE_BATCH_LIMIT = 100"]]]){for(const needle of needles)if(!source.includes(needle))throw new Error(`Missing ${needle} in ${name} release operation`);}
if(scheduler.includes("searchParams")||scheduler.includes("request.json")||admin.includes("request.json")||operation.includes("p_limit"))throw new Error("Release operation accepts caller-controlled financial or time input");
if(!cron.includes("/api/internal/commercial/release-matured")||!cron.includes("0 4 * * *"))throw new Error("Daily earnings release cron is missing");

function listen(server){return new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve(server.address().port));});}
async function reservePort(){const server=createServer();const port=await listen(server);await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;}
function stop(child){if(!child||child.exitCode!==null)return Promise.resolve();return new Promise(resolve=>{const timer=setTimeout(resolve,5_000);child.once("exit",()=>{clearTimeout(timer);resolve();});child.kill("SIGINT");});}
async function waitFor(url,headers,diagnostic){let lastError;for(let attempt=0;attempt<80;attempt++){try{return await fetch(url,{headers,signal:AbortSignal.timeout(5_000)});}catch(error){lastError=error;}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error(`Timed out waiting for the local Next route: ${lastError?.message??"unknown error"}\n${diagnostic()}`);}
async function startNext({cronSecret,supabaseUrl}){
  const port=await reservePort();
  const env={...process.env,NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:supabaseUrl,SUPABASE_SERVICE_ROLE_KEY:"phase1c2b-local-test-key",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"phase1c2b-local-public-key",CRON_SECRET:cronSecret};
  const child=spawn(process.execPath,[path.join(root,"node_modules","next","dist","bin","next"),"dev","-p",String(port)],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
  let output="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);
  return {child,url:`http://127.0.0.1:${port}/api/internal/commercial/release-matured`,output:()=>output};
}

const calls=[];
const mock=createServer(async(request,response)=>{
  const body=await new Promise(resolve=>{let value="";request.on("data",chunk=>value+=chunk);request.on("end",()=>resolve(value));});
  const rpc=new URL(request.url,"http://127.0.0.1").pathname.replace("/rest/v1/rpc/","");
  calls.push({rpc,body:body?JSON.parse(body):null});
  const value=rpc==="start_learning_instructor_earnings_release_run"?901:rpc==="execute_learning_instructor_earnings_release_run"?0:null;
  response.writeHead(value===null?404:200,{"content-type":"application/json"});response.end(value===null?JSON.stringify({message:"unexpected rpc"}):JSON.stringify(value));
});
const mockPort=await listen(mock);const mockUrl=`http://127.0.0.1:${mockPort}`;
const testSecret="phase1c2b-cron-runtime-test-secret";
const nextEnvPath=path.join(root,"next-env.d.ts");
const originalNextEnv=await readFile(nextEnvPath,"utf8");
let missing;let valid;
try{
  missing=await startNext({cronSecret:"",supabaseUrl:mockUrl});
  const missingResponse=await waitFor(missing.url,undefined,missing.output);
  if(missingResponse.status!==401||JSON.stringify(await missingResponse.json())!==JSON.stringify({code:"unauthorized"}))throw new Error("Missing CRON_SECRET did not fail closed with the safe 401 response");
  if(calls.length!==0)throw new Error("Missing CRON_SECRET reached the financial release RPC");
  await stop(missing.child);

  valid=await startNext({cronSecret:testSecret,supabaseUrl:mockUrl});
  const invalidResponse=await waitFor(valid.url,{authorization:"Bearer incorrect-test-secret"},valid.output);
  if(invalidResponse.status!==401||JSON.stringify(await invalidResponse.json())!==JSON.stringify({code:"unauthorized"}))throw new Error("Invalid CRON_SECRET did not fail closed with the safe 401 response");
  if(calls.length!==0)throw new Error("Invalid CRON_SECRET reached the financial release RPC");

  const validResponse=await fetch(valid.url,{headers:{authorization:`Bearer ${testSecret}`},signal:AbortSignal.timeout(5_000)});
  const validBody=await validResponse.json();
  if(validResponse.status!==200||validBody.status!=="completed"||validBody.releasedCount!==0||Object.keys(validBody).sort().join(",")!=="releasedCount,status")throw new Error(`Valid CRON_SECRET did not return the safe completed release result: ${validResponse.status} ${JSON.stringify(validBody)} ${JSON.stringify(calls)}`);
  if(JSON.stringify(validBody).includes(testSecret)||new URL(validResponse.url).search)throw new Error("CRON_SECRET was exposed in the response or URL");
  if(calls.length!==2||calls[0].rpc!=="start_learning_instructor_earnings_release_run"||calls[1].rpc!=="execute_learning_instructor_earnings_release_run"||calls[0].body?.p_invocation_source!=="scheduler"||calls[0].body?.p_actor_user_id!==null||calls[1].body?.p_run_id!==901)throw new Error("Valid CRON_SECRET did not reach only the authoritative release RPC path");
  if(calls.some(call=>Object.values(call.body??{}).some(value=>typeof value==="string"&&value.includes(testSecret))))throw new Error("CRON_SECRET was forwarded to the financial release RPC");
}finally{await stop(missing?.child);await stop(valid?.child);await new Promise(resolve=>mock.close(resolve));await writeFile(nextEnvPath,originalNextEnv,"utf8");}

console.log("PASS Phase 1C2B release endpoint runtime authorization, admin protection, and cron configuration");
