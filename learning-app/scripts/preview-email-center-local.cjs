/* eslint-disable @typescript-eslint/no-require-imports */
// Local browser harness: actual component/API/SQL, fake session and in-memory DB.
// No .env files, service credentials, contacts or provider API are used.
const {readFileSync,mkdtempSync}=require('node:fs');
const path=require('node:path'),os=require('node:os'),vm=require('node:vm'),http=require('node:http');
const ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),output=mkdtempSync(path.join(os.tmpdir(),'learning-email-center-'));
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const operator='00000000-0000-4000-8000-000000000001',learner='00000000-0000-4000-8000-000000000002';
(async()=>{
  await new Promise((resolve,reject)=>webpack({
    mode:'development',devtool:false,context:root,entry:path.join(__dirname,'email-center-local-entry.tsx'),
    output:{path:output,filename:'client.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':root}},
    module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.join(__dirname,'email-center-local-loader.cjs')}]},
  },(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table public.profiles(id uuid primary key,account_type text);create table public.instructor_profiles(user_id uuid,approval_status text);
    create table public.learning_company_workspaces(id bigint,status text);create table public.learning_company_memberships(user_id uuid,workspace_id bigint,status text,role text);
    create table public.learning_email_preferences(user_id uuid primary key references auth.users,marketing_opt_in boolean not null default false,changed_at timestamptz default now(),unsubscribe_token uuid not null unique default gen_random_uuid());
    insert into auth.users values('${operator}','admin@growvelt.com',now(),'{}'),('${learner}','learner@example.invalid',now(),'{"full_name":"Alex Example"}');
    insert into profiles values('${operator}','admin'),('${learner}','learner');insert into learning_email_preferences(user_id,marketing_opt_in) values('${learner}',true);`);
  for(const file of ['20261107000000_add_learning_email_center_drafts.sql','20261108000000_add_learning_email_consent_and_budget_controls.sql','20261109000000_add_learning_email_broadcast_recovery.sql'])await db.exec(readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
  const client={auth:{getUser:async()=>({data:{user:{id:operator,email:'admin@growvelt.com',email_confirmed_at:'2026-10-22'}},error:null})},rpc:async(name,args)=>{
    if(name==='is_growvelt_learning_admin')return{data:true,error:null};
    const names={save_learning_email_center_draft:['p_actor','p_id','p_revision','p_document'],review_learning_email_center_draft:['p_actor','p_id','p_revision'],read_learning_email_center_review:['p_actor','p_id','p_revision'],approve_learning_email_release:['p_actor','p_id','p_revision','p_recipients'],check_learning_email_release:['p_actor','p_id','p_revision'],start_learning_email_broadcast:['p_actor','p_id','p_revision','p_holder'],advance_learning_email_broadcast:['p_actor','p_id','p_expected','p_next','p_provider_id','p_provider_status']};
    if(!names[name])throw new Error('RPC not permitted in fixture');
    try{const result=await db.query(`select public.${name}(${names[name].map((_,i)=>'$'+(i+1)).join(',')}) as result`,names[name].map(key=>args[key]));return{data:result.rows[0].result,error:null};}catch(error){return{data:null,error:{code:error.code}};}
  },from:table=>{
    if(!['learning_email_center_drafts','learning_email_campaigns','learning_email_broadcast_operations','learning_email_center_attempts'].includes(table))throw new Error('Table not permitted in fixture');
    const filters=[];let fields='*';
    const result=async(single=false)=>{if(table==='learning_email_campaigns')return{data:[],error:null};const rows=await db.query(`select ${fields} from ${table}${filters.length?' where '+filters.map(([key],i)=>`${key}=$${i+1}`).join(' and '):''} limit 100`,filters.map(([,value])=>value));return{data:single?rows.rows[0]??null:rows.rows,error:null};};
    const query={select:value=>{fields=value;return query;},eq:(key,value)=>{filters.push([key,value]);return query;},order:()=>query,limit:()=>query,maybeSingle:()=>result(true),then:(resolve,reject)=>result().then(resolve,reject)};return query;
  }};
  const providerContact={id:'40000000-0000-4000-8000-000000000001',email:'learner@example.invalid',unsubscribed:false};
  const members=new Set(),broadcasts=new Map();
  const runtime={emailCenterRelease:()=>({enabled:true,emails:[providerContact.email]}),
    async checkEmailCenterTestRecipients(database,actor,id,revision){const result=await database.rpc('read_learning_email_center_review',{p_actor:actor,p_id:id,p_revision:revision});if(result.error)throw new Error('Fixture review failed');return result.data;},
    emailCenterProviderRuntime:()=>({membership:{async setMember(id,member){if(member)members.add(id);else members.delete(id);}},transport:{
      senderIdentity:()=> 'Growvelt Learning <learning@growvelt.com>',
      async readAudience(segmentOnly=false){return{complete:true,contacts:!segmentOnly||members.has(providerContact.id)?[providerContact]:[]};},
      async readMarketingUsage(){return{checkedAt:Date.now(),contacts:{used:1,limit:1000}};},
      async createBroadcastDraft(input){const id=require('node:crypto').randomUUID();broadcasts.set(id,{id,status:'draft',name:input.operationKey});return{id};},
      async getBroadcast(id){return broadcasts.get(id);},matchesBroadcast:()=>true,
      async sendBroadcast(id){broadcasts.get(id).status='queued';return{id};},async cancelBroadcast(id){broadcasts.get(id).status='canceled';return{id};},
      async findBroadcast(name){return[...broadcasts.values()].find(item=>item.name===name).id;},
    }})};
  const cache=new Map();
  function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:mod.exports,URL,Request,Response,Headers,TextDecoder,process:{env:{}},
    require:name=>name==='server-only'?{}:name==='@/app/lib/supabase/server'?{createClient:async()=>client}:name==='@/app/lib/supabase/admin'?{createAdminClient:()=>client}:name==='@/app/lib/email/email-center-runtime'?runtime:['@/app/lib/email/email-center-account-worker','@/app/lib/email/email-center-consent-worker'].includes(name)?{}:name.endsWith('site-urls.mjs')?{learningAbsoluteUrl:value=>'https://www.growvelt.com'+value}:name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('./')?load('app/lib/email/'+name.slice(2)+'.ts'):require(name),
  });cache.set(file,mod.exports);return mod.exports;}
  const api=load('app/api/learning/admin/emails/route.ts');
  const baseCss=readFileSync(path.join(root,'app/globals.css'),'utf8').replace('@import "tailwindcss";','');
  const componentCss=readFileSync(path.join(root,'app/dashboard/admin/emails/workspace.module.css'),'utf8');
  const server=http.createServer(async(req,res)=>{try{
    if(req.url==='/client.js'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(path.join(output,'client.js')));return;}
    if(req.url==='/api/learning/admin/emails'){
      const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>32768){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request('http://127.0.0.1:4317'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const response=req.method==='POST'?await api.POST(request):await api.GET();res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.url!=='/'){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Learning Email Center · Local test fixture</title><style>${baseCss}\n${componentCss}\nbody{padding:0 24px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:620px){body{padding:0 12px}}</style></head><body><div id="root"></div><script src="/client.js"></script></body></html>`);
  }catch{res.writeHead(500);res.end('Local fixture error. No hosted service was used.');}});
  server.listen(4317,'127.0.0.1',()=>console.log('LOCAL FIXTURE http://127.0.0.1:4317 — actual composer/API/SQL, fake accounts, no provider delivery. Ctrl+C stops; data is memory-only.'));
  process.on('SIGINT',()=>{server.close();db.close().finally(()=>process.exit());});
})().catch(error=>{console.error(error.message);process.exitCode=1;});
