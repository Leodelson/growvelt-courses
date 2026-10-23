import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const require=createRequire(import.meta.url),cache=new Map();
function load(name) {
  if(cache.has(name)) return cache.get(name);
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/lib/email/${name}.ts`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports:mod.exports,URL,AbortSignal,process,fetch:async()=>assert.fail("Live network is forbidden"),require:id=>id==="server-only"?{}:id.endsWith("site-urls.mjs")?{learningAbsoluteUrl:path=>`https://www.growvelt.com${path}`}:id.startsWith("./")?load(id.slice(2)):require(id)});
  cache.set(name,mod.exports);return mod.exports;
}
const {runLearningBroadcast}=load("email-center-broadcast-worker"),{createEmailCenterResendTransport}=load("email-center-resend");
const operator="00000000-0000-4000-8000-000000000001",learner="00000000-0000-4000-8000-000000000002",foreign="00000000-0000-4000-8000-000000000003";
const contact={id:"40000000-0000-4000-8000-000000000001",email:"learner@example.invalid",unsubscribed:false};
const runtime=load("email-center-runtime");
const envNames=["LEARNING_EMAIL_CENTER_RELEASE","LEARNING_EMAIL_CENTER_RECOVERY","LEARNING_EMAIL_CENTER_TEST_RECIPIENTS","RESEND_LEARNING_SEGMENT_ID","LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS"],previousEnv=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
try {
  process.env.LEARNING_EMAIL_CENTER_RELEASE="disabled";process.env.LEARNING_EMAIL_CENTER_RECOVERY="disabled";
  assert.equal(runtime.emailCenterRelease().enabled,false);assert.throws(()=>runtime.emailCenterProviderRuntime(),/not activated/);
  process.env.LEARNING_EMAIL_CENTER_RECOVERY="enabled";
  assert.throws(()=>runtime.emailCenterProviderRuntime(),/not activated/,"recovery permission must not enable new sends");
  assert.ok(runtime.emailCenterProviderRuntime({recoveryOnly:true}).transport);
  process.env.LEARNING_EMAIL_CENTER_RELEASE="controlled-test";
  process.env.RESEND_LEARNING_SEGMENT_ID=load("email-center-audience").LEARNING_EMAIL_SEGMENT_ID;
  process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS=contact.email;
  assert.equal(runtime.emailCenterRelease().enabled,true);
  await assert.rejects(runtime.checkEmailCenterRecipients({rpc:async()=>({data:{targets:[{email:"careers@example.invalid"}]},error:null})},operator,learner,1),/allowlist/);
  process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS=Array.from({length:11},(_,n)=>`user${n}@example.invalid`).join(",");
  assert.equal(runtime.emailCenterRelease().enabled,false,"controlled release cannot expand past ten approved addresses");
  process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS=contact.email;
  process.env.RESEND_LEARNING_SEGMENT_ID="a8776ea3-0012-4c55-a887-1c0153466738";
  assert.equal(runtime.emailCenterRelease().enabled,false,"Careers segment never activates Learning release");
  process.env.RESEND_LEARNING_SEGMENT_ID=load("email-center-audience").LEARNING_EMAIL_SEGMENT_ID;
  process.env.LEARNING_EMAIL_CENTER_RELEASE="admin-live";
  for(const invalid of ["","0","101","1.5"," 100","100 ","Infinity","1e2"]){
    process.env.LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS=invalid;
    assert.equal(runtime.emailCenterRelease().enabled,false,"live mode requires an explicit bounded integer limit");
  }
  process.env.LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS="100";
  delete process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS;
  assert.equal(runtime.emailCenterRelease().enabled,true);
  const targets=Array.from({length:100},(_,n)=>({email:`learning${n}@example.invalid`,confirmed:true,marketingOptIn:true}));
  const check=async(values,mode="marketing")=>runtime.checkEmailCenterRecipients({rpc:async()=>({data:{document:{mode},targets:values},error:null})},operator,learner,1);
  assert.equal((await check(targets)).targets.length,100,"live marketing accepts the reviewed Learning audience, not a test allowlist");
  await assert.rejects(check([...targets,{email:"extra@example.invalid",confirmed:true,marketingOptIn:true}]),/limit/);
  await assert.rejects(check([{...targets[0],marketingOptIn:false}]),/consent/);
  await assert.rejects(check([{...targets[0],confirmed:false}]),/Confirmed/);
  await assert.rejects(check([targets[0],{...targets[0],email:targets[0].email.toUpperCase()}]),/unique/);
  await assert.rejects(check(targets.slice(0,11),"transactional"),/Confirmed/);
  assert.equal((await check([{...targets[0],marketingOptIn:false}],"transactional")).targets.length,1,"genuine account notices do not require marketing consent; quota still applies");
  process.env.RESEND_LEARNING_SEGMENT_ID="a8776ea3-0012-4c55-a887-1c0153466738";
  assert.equal(runtime.emailCenterRelease().enabled,false,"live release cannot target Careers segments");
}finally{for(const name of envNames){if(previousEnv[name]===undefined)delete process.env[name];else process.env[name]=previousEnv[name];}}
const db=new PGlite();
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table profiles(id uuid primary key,account_type text);create table instructor_profiles(user_id uuid,approval_status text);
    create table learning_company_workspaces(id bigint primary key,status text);create table learning_company_memberships(user_id uuid,workspace_id bigint,status text,role text);
    create table learning_email_preferences(user_id uuid primary key references auth.users,marketing_opt_in boolean not null default false,changed_at timestamptz default now(),unsubscribe_token uuid not null unique default gen_random_uuid());`);
  for(const file of ["20261107000000_add_learning_email_center_drafts.sql","20261108000000_add_learning_email_consent_and_budget_controls.sql","20261109000000_add_learning_email_broadcast_recovery.sql"]) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
  await query("insert into auth.users(id,email,email_confirmed_at) values($1,'nduleonardc@gmail.com',now()),($2,'learner@example.invalid',now()),($3,'other@example.invalid',now())",[operator,learner,foreign]);
  await query("insert into profiles(id,account_type) values($1,'learner'),($2,'learner')",[learner,foreign]);
  await query("select set_learning_email_preference($1,true)",[learner]);
  const names={read_learning_email_center_review:["p_actor","p_id","p_revision"],start_learning_email_broadcast:["p_actor","p_id","p_revision","p_holder"],advance_learning_email_broadcast:["p_actor","p_id","p_expected","p_next","p_provider_id","p_provider_status"]};
  const database={
    async rpc(name,args) {try{return {data:(await query(`select ${name}(${names[name].map((_,n)=>`$${n+1}`).join(",")}) as value`,names[name].map(key=>args[key])))[0].value,error:null};}catch(error){return {data:null,error};}},
    from(table) {const filters=[];let fields;const builder={select(value){fields=value;return builder;},eq(key,value){filters.push([key,value]);return builder;},async maybeSingle(){assert.ok(["learning_email_center_drafts","learning_email_broadcast_operations"].includes(table));const rows=await query(`select ${fields} from ${table} where ${filters.map(([key],n)=>`${key}=$${n+1}`).join(" and ")}`,filters.map(([,value])=>value));return {data:rows[0]??null,error:null};}};return builder;}
  };
  const remote=new Map(),members=new Set(),calls=[];
  let loseCreate=false,loseSend=false,sendStatus="queued",missing=false,corrupt=false,serial=0;
  const transport=createEmailCenterResendTransport({marketingKey:"re_fixture",transactionalKey:"re_fixture",senders:{learning:"learning@growvelt.com"},verifiedDomains:["growvelt.com"],allowProviderWrites:true,pace:async()=>undefined,
    request:async(url,init)=>{
      const path=new URL(url).pathname;calls.push([path,init.method]);
      if(path==="/usage")return Response.json({object:"usage",emails:{daily:{used:9,limit:100},monthly:{used:138,limit:3000}},contacts:{used:592,limit:1000},segments:{used:3,limit:3}});
      if(path==="/contacts")return Response.json({has_more:false,data:missing?[]:(!new URL(url).searchParams.has("segment_id")||members.has(contact.id)?[contact]:[])});
      if(path==="/broadcasts"&&init.method==="GET")return Response.json({has_more:false,data:[...remote.values()]});
      if(path==="/broadcasts"&&init.method==="POST") {const id=`50000000-0000-4000-8000-${String(++serial).padStart(12,"0")}`;remote.set(id,{...JSON.parse(init.body),id,status:"draft"});if(loseCreate)throw new Error("lost reply");return Response.json({id});}
      const [, ,id,operation]=path.split("/");const record=remote.get(id);assert.ok(record);
      if(operation==="send"){record.status=sendStatus;if(loseSend)throw new Error("lost reply");return Response.json({id});}
      if(operation==="cancel"){record.status="canceled";return Response.json({id});}
      return Response.json({...record,...(corrupt?{subject:"Changed elsewhere"}:{})});
    }});
  const membership={async setMember(id,member){if(member)members.add(id);else members.delete(id);}};
  const base={...load("email-center").emptyEmailDocument,subject:"Learning test update",message:"A controlled Learning update for opted-in contacts.",audience:"specific",recipients:[learner]};
  const make=async n=>{const id=`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;await query("select save_learning_email_center_draft($1,$2,0,$3)",[operator,id,base]);await query("select review_learning_email_center_draft($1,$2,1)",[operator,id]);return {database,transport,membership,actorId:operator,draftId:id,revision:1,enabled:true};};
  const approve=async input=>query("select approve_learning_email_release($1,$2,1,$3)",[operator,input.draftId,[contact.email]]);
  const phase=async input=>(await query("select phase from learning_email_broadcast_operations where draft_id=$1",[input.draftId]))[0]?.phase;
  const sendCalls=()=>calls.filter(([path])=>path.endsWith("/send")).length;
  const first=await make(1);
  await assert.rejects(runLearningBroadcast({...first,enabled:false},"prepare"),/not activated/);assert.equal(calls.length,0);
  missing=true;await assert.rejects(runLearningBroadcast(first,"prepare"),/approved provider import/);assert.equal(await phase(first),undefined,"missing contacts block before durable lease");missing=false;
  assert.equal((await runLearningBroadcast(first,"prepare")).state,"draft");assert.equal(sendCalls(),0);
  assert.equal((await runLearningBroadcast(first,"prepare")).state,"already_claimed");
  await assert.rejects(query("select approve_learning_email_release($1,$2,1,$3)",[operator,first.draftId,["careers@example.invalid"]]),/exact reviewed/);
  await assert.rejects(runLearningBroadcast(first,"dispatch"),/checkpoint/);assert.equal(sendCalls(),0,"release approval is mandatory");
  await approve(first);loseSend=true;
  await assert.rejects(runLearningBroadcast(first,"dispatch"),/could not be confirmed/);assert.equal(sendCalls(),1);assert.equal(await phase(first),"dispatching");
  assert.equal((await runLearningBroadcast(first,"dispatch")).state,"already_claimed");assert.equal(sendCalls(),1);
  assert.equal((await runLearningBroadcast(first,"reconcile")).state,"queued");assert.equal(sendCalls(),1);
  const second=await make(2);assert.equal((await runLearningBroadcast(second,"prepare")).state,"already_claimed","queued audience retains exclusive lease");
  await query("select set_learning_email_preference($1,false)",[learner]);
  assert.equal((await runLearningBroadcast(first,"cancel")).state,"canceled","cancellation/recovery works after opt-out");
  await query("select set_learning_email_preference($1,true)",[learner]);
  loseSend=false;loseCreate=true;
  await assert.rejects(runLearningBroadcast(second,"prepare"),/could not be confirmed/);assert.equal(await phase(second),"creating");
  const created=remote.size;assert.equal((await runLearningBroadcast(second,"reconcile")).state,"draft");assert.equal(remote.size,created,"lost create response adopts unique exact existing draft, never recreates");
  corrupt=true;await assert.rejects(runLearningBroadcast(second,"reconcile"),/Quarantined/);corrupt=false;
  await approve(second);await query("update learning_email_release_approvals set expires_at=now()-interval '1 second' where draft_id=$1",[second.draftId]);
  await assert.rejects(runLearningBroadcast(second,"dispatch"),/checkpoint/);assert.equal(sendCalls(),1);
  await approve(second);sendStatus="draft";loseSend=true;await assert.rejects(runLearningBroadcast(second,"dispatch"),/could not be confirmed/);
  assert.equal((await runLearningBroadcast(second,"reconcile")).state,"dispatching");assert.equal(sendCalls(),2,"provider draft after uncertain dispatch never authorizes retry");
  await assert.rejects(query("select advance_learning_email_broadcast($1,$2,'dispatching','draft',$3,'draft')",[operator,second.draftId,[...remote.keys()].at(-1)]),/Unsafe/);
  await db.exec("set role authenticated");await assert.rejects(query("select * from learning_email_broadcast_operations"),/permission denied/);await db.exec("reset role");
  console.log("PASS real local SQL + worker + fake Resend: exact release approvals, no-consent/import gates, lost create/send recovery, no duplicate dispatch, queued lease isolation, opt-out cancellation, content mismatch quarantine, expired approvals, RLS. No live calls.");
}finally{await db.close();}
