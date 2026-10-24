import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {loadEmail} from "./test-email-mobile-dark.mjs";
const {runAdminSubmissionAlerts,adminAlertRecipients}=loadEmail("admin-submission-worker");
const {readAdminSubmission,renderAdminSubmission}=loadEmail("admin-submission-content");
const database=new PGlite();
const actor="00000000-0000-4000-8000-000000000001",holder="00000000-0000-4000-8000-000000000002",other="00000000-0000-4000-8000-000000000003";
try{
  await database.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key);create table profiles(id uuid primary key,full_name text,email text);
    create table learning_public_inquiries(id bigint generated always as identity primary key,inquiry_type text,full_name text,email text,subject text,message text,organization text,phone text,created_at timestamptz default now());
    create table instructor_profiles(user_id uuid primary key,headline text,country text,phone text,expertise text[],years_experience integer,teaching_experience text,bio text,motivation text,portfolio_url text,approval_status text default 'pending',created_at timestamptz default now());
    create table learning_provider_organization_verifications(organization_id bigint primary key,status text,submitted_by uuid,legal_name text,contact_email text,website_url text,verification_statement text,submitted_at timestamptz default now());
    create table learning_courses(id bigint primary key,instructor_id uuid,status text,title text,summary text,description text,category text,level text,is_free boolean,price_amount numeric,price_currency text,submitted_at timestamptz);
    create table learning_support_conversations(id uuid primary key,subject text,topic text);
    create table learning_support_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_user_id uuid,sender_role text,body text,created_at timestamptz default now());
    insert into learning_public_inquiries(inquiry_type)values('contact');`);
  await database.exec(readFileSync(new URL("../supabase/migrations/20261110000000_add_admin_submission_alerts.sql",import.meta.url),"utf8"));
  const query=async(sql,args=[]) => JSON.parse(JSON.stringify((await database.query(sql,args)).rows,(_key,value)=>typeof value==="bigint"?String(value):value));
  const count=async()=>Number((await query("select count(*) from learning_admin_submission_alerts"))[0].count);
  assert.equal(await count(),0,"migration never emails historical submissions");
  await query("insert into auth.users values($1)",[actor]);await query("insert into profiles values($1,'Fixture User','fixture@example.invalid')",[actor]);
  await query("insert into learning_public_inquiries(inquiry_type,full_name,email,subject,message,organization,phone)values('partnership','Fixture User','fixture@example.invalid','A training partnership','<script>not HTML</script> This is a local fixture.','Fixture Org','not a real phone')");
  await query("insert into instructor_profiles(user_id,headline,country,expertise,years_experience,teaching_experience,bio,motivation,portfolio_url)values($1,'Practical instructor','Nigeria',array['Data'],3,'Training teams','Fixture biography','Fixture motivation','https://example.invalid')",[actor]);
  await query("update instructor_profiles set headline='Edited headline' where user_id=$1",[actor]);
  assert.equal(await count(),2,"editing a profile does not create another application alert");
  await query("insert into learning_provider_organization_verifications(organization_id,status,submitted_by,legal_name,contact_email,website_url,verification_statement)values(1,'pending',$1,'Fixture Provider','fixture@example.invalid','https://example.invalid','Fixture provider verification statement')",[actor]);
  await query("update learning_provider_organization_verifications set status='verified' where organization_id=1");
  assert.equal(await count(),3,"admin decisions do not create new submission alerts");
  await query("update learning_provider_organization_verifications set status='pending',submitted_at=now()+interval '1 second' where organization_id=1");
  await query("update learning_provider_organization_verifications set legal_name='Changed Provider' where organization_id=1");
  assert.equal(await count(),4,"one new version on resubmission, no duplicate pending edit");
  await query("insert into learning_courses values(1,$1,'draft','Fixture course','Summary','Description','Data','Beginner',true,0,'NGN',null)",[actor]);
  assert.equal(await count(),4,"saving a draft is not a review submission");
  await query("update learning_courses set status='pending_review',submitted_at=now() where id=1");
  await query("insert into learning_support_conversations values($1,'Course support','courses')",[other]);
  await query("insert into learning_support_messages(conversation_id,sender_user_id,sender_role,body)values($1,$2,'customer','A support request for the fixture'),($1,$2,'support','A support reply does not notify admins again')",[other,actor]);
  assert.equal(await count(),6);
  assert.equal(Number((await query("select count(*) from learning_admin_submission_deliveries"))[0].count),12,"every qualifying submission has both admin delivery records");
  for(const role of ["anon","authenticated"]){
    const grants=await query("select has_table_privilege($1,'learning_admin_submission_alerts','select') as can_read,has_function_privilege($1,'claim_learning_admin_submission_delivery(uuid,uuid,integer)','execute') as can_claim",[role]);assert.equal(grants[0].can_read,false);assert.equal(grants[0].can_claim,false);
  }
  assert.equal((await query("select acquire_learning_admin_alert_run($1) as ok",[holder]))[0].ok,true);
  assert.equal((await query("select acquire_learning_admin_alert_run($1) as ok",[other]))[0].ok,false);
  const first=(await query("select id from learning_admin_submission_deliveries order by id limit 1"))[0].id;
  assert.equal((await query("select claim_learning_admin_submission_delivery($1,$2,null) as ok",[first,holder]))[0].ok,false);
  assert.equal((await query("select claim_learning_admin_submission_delivery($1,$2,20) as ok",[first,other]))[0].ok,false);
  await query("select release_learning_admin_alert_run($1)",[other]);
  assert.equal((await query("select acquire_learning_admin_alert_run($1) as ok",[other]))[0].ok,false,"wrong holder cannot release a lease");
  await query("select release_learning_admin_alert_run($1)",[holder]);
  const names={acquire_learning_admin_alert_run:["p_holder"],release_learning_admin_alert_run:["p_holder"],claim_learning_admin_submission_delivery:["p_id","p_holder","p_daily_limit"]};
  let failCheckpoint=false;
  const client={
    async rpc(name,args){try{return{data:(await query(`select ${name}(${names[name].map((_,i)=>`$${i+1}`).join(",")}) as value`,names[name].map(key=>args[key])))[0].value,error:null};}catch(error){return{data:null,error};}},
    from(table){
      assert.match(table,/^[a-z_]+$/);let columns="*",updates=null,filters=[],orders=[],maximum="";
      const builder={select(text){columns=text;return builder;},update(value){updates=value;return builder;},eq(key,value){filters.push([key,"=",value]);return builder;},lte(key,value){filters.push([key,"<=",value]);return builder;},order(key){orders.push(key);return builder;},limit(n){maximum=` limit ${Number(n)}`;return builder;},
        async execute(single=false){try{if(failCheckpoint&&updates?.state==="accepted")return{data:null,error:{message:"lost audit write"}};const args=[];const bind=value=>{args.push(value);return`$${args.length}`;};const set=updates?Object.entries(updates).map(([key,value])=>`${key}=${bind(value)}`).join(","):"";const where=filters.length?" where "+filters.map(([key,op,value])=>`${key}${op}${bind(value)}`).join(" and "):"";const sql=updates?`update ${table} set ${set}${where}`:`select ${columns} from ${table}${where}${orders.length?" order by "+orders.join(","):""}${maximum}`;const rows=await query(sql,args);return{data:single?(rows[0]??null):rows,error:null};}catch(error){return{data:null,error};}},
        maybeSingle(){return builder.execute(true);},single(){return builder.execute(true);},then(resolve,reject){return builder.execute().then(resolve,reject);}};return builder;
    }
  };
  const sent=[];let rejectProvider=false;
  const input={database:client,enabled:true,dailyLimit:20,usage:async()=>({checkedAt:Date.now(),daily:{used:3,limit:100},monthly:{used:30,limit:3000},contacts:{used:592,limit:1000},segments:{used:3,limit:3}}),send:async message=>{sent.push(message);if(rejectProvider)throw Error("lost provider reply");return{id:`60000000-0000-4000-8000-${String(sent.length).padStart(12,"0")}`};}};
  assert.equal((await runAdminSubmissionAlerts({...input,enabled:false})).state,"disabled");assert.equal(sent.length,0);
  assert.equal((await runAdminSubmissionAlerts({...input,usage:async()=>({...await input.usage(),daily:{used:76,limit:100}})})).state,"waiting_for_quota");assert.equal(sent.length,0);
  for(let i=0;i<8;i++)await runAdminSubmissionAlerts(input);
  // The old provider version is superseded; other five events each send twice.
  assert.equal(sent.length,10);
  assert.deepEqual([...new Set(sent.map(x=>x.to))].sort(),Object.values(adminAlertRecipients).sort());
  assert.equal(new Set(sent.map(x=>x.key)).size,10);
  assert.ok(sent.some(x=>x.html.includes("&lt;script&gt;not HTML&lt;/script&gt;")));
  assert.ok(sent.every(x=>!x.html.includes("<script>")));
  assert.equal((await runAdminSubmissionAlerts(input)).accepted,0,"accepted/failed rows are never blindly resent");
  await query("insert into learning_public_inquiries(inquiry_type,full_name,email,subject,message)values('contact','Fixture','fixture@example.invalid','New request','A new local request for an uncertainty fixture')");
  rejectProvider=true;await runAdminSubmissionAlerts(input);assert.equal(Number((await query("select count(*) from learning_admin_submission_deliveries where state='uncertain'"))[0].count),2);
  const oldCount=sent.length;await runAdminSubmissionAlerts(input);assert.equal(sent.length,oldCount,"uncertain delivery cannot be retried");
  rejectProvider=false;await query("insert into learning_public_inquiries(inquiry_type,full_name,email,subject,message)values('contact','Fixture','fixture@example.invalid','Checkpoint fixture','A local request for a lost audit checkpoint')");
  failCheckpoint=true;await assert.rejects(runAdminSubmissionAlerts(input),/audit checkpoint/);failCheckpoint=false;
  assert.equal(Number((await query("select count(*) from learning_admin_submission_deliveries where state='dispatching'"))[0].count),1,"lost checkpoint preserves the no-resend claim");
  await runAdminSubmissionAlerts(input);assert.equal(Number((await query("select count(*) from learning_admin_submission_deliveries where state='dispatching'"))[0].count),1);
  await query("update learning_admin_alert_daily_budget set reserved=20");
  await query("insert into learning_public_inquiries(inquiry_type,full_name,email,subject,message)values('contact','Fixture','fixture@example.invalid','Budget fixture','A local request waiting safely for the daily budget')");
  assert.equal((await runAdminSubmissionAlerts(input)).state,"budget_or_claim_blocked");
  assert.ok(Number((await query("select count(*) from learning_admin_submission_deliveries where state='pending'"))[0].count)>=2,"overflow remains saved and queued");
  const instructor=(await query("select * from learning_admin_submission_alerts where kind='instructor'"))[0];const content=await readAdminSubmission(client,instructor);assert.ok(content.fields.some(x=>x.label==="Motivation"));assert.match(renderAdminSubmission(content),/Review submission/);
  console.log("PASS real local SQL + admin alert worker: five submission sources, no backfill, both recipients, private grants/RLS, source versions, lease isolation, quota/cap denial, escaped details, exact idempotency, no resend after timeout/lost checkpoint, queued overflow. No live email or hosted changes.");
}finally{await database.close();}
