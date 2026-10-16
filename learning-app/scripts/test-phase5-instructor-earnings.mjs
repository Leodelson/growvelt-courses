// Isolated own-earnings rendering; no provider or backend calls.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();let approved=true,empty=false,failed=false,locale='en';
const states=['held','available','reserved','paid','reversed','recoverable'];
const earnings=states.map((state,index)=>({earning_id:index+1,allocation_id:index+1,order_id:index+1,order_reference:'EXAMPLE-'+state,course_id:7,course_title:'Example course '+state,order_paid_at:null,gross_amount_minor:10000,platform_commission_minor:2000,instructor_gross_minor:8000,currency:'NGN',earning_status:state,available_at:'invalid',released_at:null,reversed_at:null,recoverable_amount_minor:state==='recoverable'?2500:0,hold_reason:state==='held'?'Example protection hold.':null,commercial_terms_version:'example-v1',allocated_at:'2026-10-16'}));
const events=earnings.map(item=>({event_id:item.earning_id,earning_id:item.earning_id,event_type:'example_recorded',from_status:null,to_status:item.earning_status,occurred_at:'invalid'}));
function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{exports:mod.exports,require(id){
 if(id==='next/link')return ({children,...props})=>React.createElement('a',props,children);
 if(id==='next/navigation')return {redirect(){throw Error('REDIRECT');}};
 if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
 if(id.endsWith('/language-provider'))return {useLanguage:()=>({locale})};
 if(id.endsWith('/instructor/authorization'))return {isApprovedInstructor:async()=>approved};
 if(id.endsWith('/instructor/earnings'))return {getOwnInstructorEarnings:async()=>{if(failed)throw Error('READ_FAILED');return {earnings:empty?[]:earnings,events:empty?[]:events};}};
 if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?id.slice(2):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}return require(id);
 }});cache.set(file,mod.exports);return mod.exports;}
const Page=load('app/dashboard/instructor/earnings/page.tsx').default;
for(locale of ['en','fr','es']){const html=renderToStaticMarkup(await Page());assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.doesNotMatch(html,/Invalid Date|NaN|undefined/);assert.match(html,/All statuses/);for(const state of states)assert.match(html,new RegExp('EXAMPLE-'+state));assert.equal((html.match(/Recorded events \(1\)/g)||[]).length,6);assert.match(html,/25\.00/);assert.match(html,/not the outstanding recovery amount/);assert.doesNotMatch(html,/fetch\(|<button[^>]*>[^<]*(withdraw|transfer|payout)/i);for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${id}"`));}
const summary=renderToStaticMarkup(await Page()).split('aria-label="Instructor earnings summary"')[1].split('</section>')[0];assert.equal((summary.match(/80\.00/g)||[]).length,6,'Every status keeps its own allocation total');
empty=true;assert.match(renderToStaticMarkup(await Page()),/Verified paid sales will appear/);empty=false;
failed=true;await assert.rejects(()=>Page(),/READ_FAILED/);failed=false;approved=false;await assert.rejects(()=>Page(),/REDIRECT/);
const presentation=fs.readFileSync('app/dashboard/instructor/earnings/earnings-overview.tsx','utf8');assert.doesNotMatch(presentation,/createAdminClient|createClient|fetch\(|\.rpc\(/);assert.match(presentation,/earning\.recoverable_amount_minor/);
console.log('PASS: own earnings gate, six status totals/history, exact recovery display, empty/error states, dates, section links and EN/FR/ES shared controls. No writes.');
