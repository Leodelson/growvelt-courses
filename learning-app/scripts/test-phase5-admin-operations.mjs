// Presentation-only rendering. No network, financial actions or database writes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map(),reads=[];
let locale='en',empty=false,readError=false,authenticated=true,admin=true;
const timestamp='2026-10-16T10:00:00Z';
const order={order_id:1,order_reference:'EXAMPLE-ORDER',learner_email:'learner@example.invalid',course_title:'Example business course',currency:'NGN',amount_minor:10000,order_status:'paid',attempt_status:'succeeded',event_status:'processed',recovery_status:null,created_at:'invalid',issue_count:2};
const earning={earning_id:1,course_title:'Example business course',instructor_name:'Example Instructor',instructor_email:'instructor@example.invalid',order_reference:'EXAMPLE-ORDER',earning_status:'held',allocation_status:'allocated',currency:'NGN',gross_amount_minor:10000,platform_commission_minor:2000,instructor_gross_minor:8000,available_at:'invalid',released_at:null,recoverable_amount_minor:0,reversal_case_id:null,reconciliation_issue_count:2,reconciliation_details:['Example finding'],commercial_terms_version:'example-v1'};
const campaign={campaign_id:1,campaign_title:'Example campaign',campaign_message:'Learn spreadsheet skills',starts_at:'invalid',ends_at:timestamp,campaign_state:'scheduled',enabled:true,course_ids:[7],course_titles:'Example business course'};
const coupon={coupon_id:1,code:'EXAMPLE10',discount_kind:'percentage',discount_value:1000,max_discount_minor:5000,minimum_charge_minor:100,starts_at:'invalid',ends_at:timestamp,max_redemptions:5,active:true,redeemed_count:2,course_ids:[7]};
const contract={contract_id:1,workspace_id:2,workspace_name:'Example Company',contract_reference:'EXAMPLE-AGREEMENT',starts_on:'2026-10-01',ends_on:null,seat_cap:10,scope_summary:'Example team learning scope.',recorded_at:'invalid',contract_state:'in_term'};
const rpcData={list_learning_promotion_coupons_for_admin:[coupon],list_learning_promotion_course_options_for_admin:[{course_id:7,title:order.course_title,price_amount:100,currency:'NGN'}],list_learning_editorial_courses_for_admin:[{course_id:7,title:order.course_title,is_free:false,price_amount:100,price_currency:'NGN'}],list_learning_editorial_campaigns_for_admin:[campaign],list_learning_enterprise_contract_workspaces_for_admin:[{workspace_id:2,workspace_name:'Example Company',workspace_slug:'example-company',seat_limit:10}],list_learning_enterprise_contract_records_for_admin:[contract],list_learning_company_seller_recovery_balances:[{purchase_id:9,booked_minor:5000,recovered_minor:1000,outstanding_minor:4000,currency:'NGN'}]};
const tables={learning_company_seller_outflow_boundaries:[{id:3,purchase_id:9,amount_minor:8000,currency:'NGN',movement_reference:'EXAMPLE-TRANSFER',recorded_at:'invalid'}],learning_company_seller_transfer_evidence:[],learning_company_paystack_settlement_evidence:[{purchase_id:9,settlement_id:'EXAMPLE-SETTLEMENT',provider_reference:'EXAMPLE-CHARGE',amount_minor:10000,settled_at:'invalid'}],learning_company_paystack_bank_settlement_evidence:[],learning_company_paid_course_purchases:[{id:9,course_title_snapshot:order.course_title,provider_name_snapshot:'Example Provider',paid_at:timestamp}]};
const result=data=>({data:empty?[]:data,error:readError?{message:'Example unavailable read'}:null});
const client={auth:{getUser:async()=>({data:{user:authenticated?{id:'example-admin'}:null}})},rpc:async name=>{reads.push(name);return result(rpcData[name]??[]);},from(name){reads.push(name);const chain={select(){return chain;},eq(){return chain;},order(){return chain;},limit(){return chain;},in(){return chain;},then(resolve,reject){return Promise.resolve(result(tables[name]??[])).then(resolve,reject);}};return chain;}};
function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{URL,URLSearchParams,crypto:webcrypto,process:{env:{}},exports:mod.exports,require(id){
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
 if(id==='next/link')return ({children,...props})=>React.createElement('a',props,children);
 if(id==='next/navigation')return {redirect(){throw Error('REDIRECT');},useRouter:()=>({refresh(){}})};
 if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
 if(id.endsWith('/language-provider'))return {useLanguage:()=>({locale,t:key=>key})};
 if(id.endsWith('/admin/authorization'))return {isLearningAdmin:async()=>admin};
 if(id.endsWith('/supabase/server'))return {createClient:async()=>client};
 if(id.endsWith('/supabase/admin'))return {createAdminClient:()=>client};
 if(id.endsWith('/payment-operations'))return {listPaymentOperations:async(_,q)=>{assert.equal(q,'EXAMPLE');return empty?[]:[order];},listRefundCases:async()=>[],listRefundCaseEvents:async()=>[],listDisputeCases:async()=>[]};
 if(id.endsWith('/commercial-operations'))return {listCommercialOperations:async()=>empty?[]:[earning],listCommercialEarningsReleaseRuns:async()=>[],listInstructorPayoutProfiles:async()=>[],listInstructorPayoutCandidates:async()=>[],listInstructorPayoutItems:async()=>[],listInstructorPayoutReconciliationFindings:async()=>[]};
 if(id.endsWith('/actions')||id==='./actions')return new Proxy({},{get:()=>()=>{throw Error('Unexpected action');}});
 if(id.endsWith('/action-submit-button'))return {ActionSubmitButton:({label})=>React.createElement('button',{type:'submit'},label)};
 if(id==='server-only')return {};
 if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?id.slice(2):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
 return require(id);
 }});cache.set(file,mod.exports);return mod.exports;}
const routes=['payments','commercial','company-commercial','promotions','enterprise-contracts'];
const pages=routes.map(route=>load(`app/dashboard/admin/${route}/page.tsx`).default);
const args={searchParams:Promise.resolve({q:'EXAMPLE'})};
for(locale of ['en','fr','es'])for(const Page of pages){const html=renderToStaticMarkup(await Page(args));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.doesNotMatch(html,/Invalid Date|NaN|undefined/);assert.match(html,/Back to admin workspaces/);for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${id}"`),id);}
locale='en';
let html=renderToStaticMarkup(await pages[0](args));assert.match(html,/Filter loaded orders/);assert.match(html,/Full refunds are operationally disabled/);assert.match(html,/EXAMPLE-ORDER/);
html=renderToStaticMarkup(await pages[1](args));assert.match(html,/Find allocations/);assert.match(html,/No Live transfer/);
html=renderToStaticMarkup(await pages[2](args));assert.match(html,/Recording is disabled/);assert.match(html,/Receipt recording is disabled/);assert.match(html,/Release remains separate and disabled/);assert.doesNotMatch(html,/Submit verified transfer evidence/);
html=renderToStaticMarkup(await pages[3](args));assert.match(html,/Test Mode coupon checkout disabled/);assert.match(html,/Disable campaign/);assert.match(html,/Disable coupon/);assert.match(html,/campaignId/);assert.match(html,/couponId/);
html=renderToStaticMarkup(await pages[4](args));assert.match(html,/executedExternally/);assert.match(html,/Records are append-only/);assert.match(html,/No end date/);assert.match(html,/EXAMPLE-AGREEMENT/);
empty=true;for(const Page of pages){html=renderToStaticMarkup(await Page(args));assert.doesNotMatch(html,/Invalid Date|NaN/);}empty=false;
readError=true;for(const Page of pages.slice(2)){html=renderToStaticMarkup(await Page(args));assert.match(html,/not available|could not be loaded/);}readError=false;
authenticated=false;assert.equal(await pages[0](args),null);assert.equal(await pages[1](args),null);authenticated=true;
admin=false;await assert.rejects(()=>load('app/dashboard/admin/layout.tsx').default({children:null}),/REDIRECT/);
assert.ok(reads.includes('list_learning_enterprise_contract_records_for_admin'));assert.ok(reads.includes('learning_company_paid_course_purchases'));
console.log('PASS: five admin operations pages, EN/FR/ES controls, loaded summaries, anchors, error/empty states, local filters, disabled financial gates, unchanged form fields and admin layout guard. No external requests or writes.');
