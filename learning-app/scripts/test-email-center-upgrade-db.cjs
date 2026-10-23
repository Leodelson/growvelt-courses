/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const operator='00000000-0000-4000-8000-000000000001',operator2='00000000-0000-4000-8000-000000000002',learner='00000000-0000-4000-8000-000000000003',instructor='00000000-0000-4000-8000-000000000004',company='00000000-0000-4000-8000-000000000005',outsider='00000000-0000-4000-8000-000000000006';
const draft='10000000-0000-4000-8000-000000000001',transactional='10000000-0000-4000-8000-000000000002';
const base={sender:'learning',mode:'marketing',audience:'all',recipients:[],subject:'Learning news',headline:'',message:'A new learning update for you.',personalized:false,buttonText:'',buttonUrl:'',bell:false};
(async()=>{const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
  create table public.profiles(id uuid primary key,account_type text);
  create table public.instructor_profiles(user_id uuid,approval_status text);
  create table public.learning_company_workspaces(id bigint primary key,status text);
  create table public.learning_company_memberships(user_id uuid,workspace_id bigint,status text,role text);
  create table public.learning_email_preferences(user_id uuid primary key,marketing_opt_in boolean default false);
  insert into auth.users(id,email,email_confirmed_at) values
  ('${operator}','nduleonardc@gmail.com',now()),('${operator2}','admin@growvelt.com',now()),
  ('${learner}','learner@example.invalid',now()),('${instructor}','teacher@example.invalid',now()),
  ('${company}','company@example.invalid',now()),('${outsider}','outsider@example.invalid',now());
  insert into profiles values('${operator}','admin'),('${operator2}','admin'),('${learner}','learner'),('${instructor}','learner'),('${company}','learner'),('${outsider}','learner');
  insert into learning_email_preferences values('${learner}',true),('${instructor}',true),('${company}',false);
  insert into instructor_profiles values('${instructor}','approved');
  insert into learning_company_workspaces values(1,'active');
  insert into learning_company_memberships values('${company}',1,'active','owner');`);
  const migration=readFileSync(new URL('../supabase/migrations/20261107000000_add_learning_email_center_drafts.sql',`file://${__filename.replaceAll('\\','/')}`),'utf8');
  await db.exec(migration);
  const save=(id,revision,document,actor=operator)=>db.query('select public.save_learning_email_center_draft($1,$2,$3,$4) as result',[actor,id,revision,document]);
  const review=(id,revision,actor=operator)=>db.query('select public.review_learning_email_center_draft($1,$2,$3) as result',[actor,id,revision]);
  const targets=async id=>(await db.query('select user_id from learning_email_center_targets where draft_id=$1 order by user_id',[id])).rows.map(row=>row.user_id);
  await assert.rejects(save(draft,0,base,outsider),/Email operator required/);
  await save(draft,0,base);
  await save(draft,0,base); // network retry of same stable draft does not duplicate it
  assert.equal((await db.query('select count(*)::int as n from learning_email_center_drafts')).rows[0].n,1);
  assert.equal((await review(draft,1)).rows[0].result.recipients,2);
  assert.deepEqual(await targets(draft),[learner,instructor]);
  await assert.rejects(save(draft,0,{...base,subject:'Stale different content'}),/Draft changed/);
  await save(draft,1,{...base,audience:'instructors'},operator2);
  assert.deepEqual(await targets(draft),[],'editing invalidates recipient snapshot');
  await review(draft,2);assert.deepEqual(await targets(draft),[instructor]);
  await save(draft,2,{...base,audience:'organizations'});
  await assert.rejects(review(draft,3),/No eligible/);
  await db.query('update learning_email_preferences set marketing_opt_in=true where user_id=$1',[company]);
  await review(draft,3);assert.deepEqual(await targets(draft),[company]);
  await save(draft,3,{...base,audience:'specific',recipients:[learner,'learner@example.invalid']});
  await review(draft,4);assert.deepEqual(await targets(draft),[learner],'overlapping email and ID deduplicate');
  await db.query('update learning_email_preferences set marketing_opt_in=false where user_id=$1',[learner]);
  await assert.rejects(db.query("select public.claim_learning_email_center_attempt($1,$2,4,'broadcast')",[operator,draft]),/Consent changed/);
  await db.query('update learning_email_preferences set marketing_opt_in=true where user_id=$1',[learner]);
  const claim=()=>db.query("select public.claim_learning_email_center_attempt($1,$2,4,'broadcast') as claimed",[operator,draft]);
  assert.equal((await claim()).rows[0].claimed,true);
  assert.equal((await claim()).rows[0].claimed,false,'unique attempt does not repeat provider call');
  await assert.rejects(save(draft,4,base),/Sending content is locked/);
  await db.query("select public.complete_learning_email_center_attempt($1,$2,'broadcast','accepted','fixture-provider-id')",[operator,draft]);
  await db.query("select public.complete_learning_email_center_attempt($1,$2,'broadcast','accepted','fixture-provider-id')",[operator,draft]);
  assert.equal((await db.query('select status from learning_email_center_drafts where id=$1',[draft])).rows[0].status,'accepted');
  await assert.rejects(db.query("select public.complete_learning_email_center_attempt($1,$2,'broadcast','uncertain',null)",[operator,draft]),/Reconciliation required/);
  await save(transactional,0,{...base,mode:'transactional',audience:'specific',recipients:[outsider]});
  await review(transactional,1);assert.deepEqual(await targets(transactional),[outsider],'genuine account messages do not require marketing opt-in');
  await save(transactional,1,{...base,audience:'specific',recipients:['missing@example.invalid']});
  await assert.rejects(review(transactional,2),/not found/);
  for (const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from learning_email_center_targets'),/permission denied/);
    await assert.rejects(save(transactional,2,base),/permission denied/);
    await db.exec('reset role');
  }
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,6,'no auth records modified');
  console.log('PASS isolated email-center SQL: two operators, stable drafts/retries, revision conflicts, all/instructor/organization/specific consent and dedup, invalidated review, opt-out-before-claim, content lock, unique claims, unknown accounts, and private RLS/grants. No hosted changes.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
