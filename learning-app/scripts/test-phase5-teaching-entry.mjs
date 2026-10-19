// Isolated request/SSR tests: no real authentication or external requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {NextRequest}=require('next/server');
let authenticated=false;
const env={NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-only-placeholder'};
function load(file) {
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{URL,process:{env},exports:mod.exports,require(id) {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
 if(id.endsWith("careers-compatibility.mjs"))return require("../app/lib/careers-compatibility.mjs");
    if(id==='@supabase/ssr') return {createServerClient:()=>({auth:{getClaims:async()=>({data:{claims:authenticated?{sub:'fixture'}:null},error:null})}})};
    if(id.endsWith('/auth/redirect')) return load('app/lib/auth/redirect.ts');
    if(id==='next/link') return function MockLink({children,...props}) { return React.createElement('a',props,children); };
    if(id.endsWith('/language-provider')) return {useLanguage:()=>({t:key=>key})};
    if(id.endsWith('/turnstile-widget')) return {TurnstileWidget:()=>null};
    if(id.endsWith('/turnstile')) return {verifyTurnstileToken:()=>{throw Error('No external requests');}};
    if(id.endsWith('/supabase/browser')) return {createClient:()=>{throw Error('No external requests');}};
    if(id.endsWith('/action-button')) return {ActionButton:({children})=>React.createElement('button',null,children)};
    if(id.endsWith('/inline-feedback')) return {InlineFeedback:()=>null};
    if(id.endsWith('/learning-icon')) return {LearningIcon:()=>null};
    return require(id);
  }}); return mod.exports;
}
const {proxy}=load('proxy.ts');
for(const [route,destination] of [['/teach/apply','/sign-up'],['/teach/application','/sign-in'],['/dashboard/explore','/sign-in']]) {
  const response=await proxy(new NextRequest('https://learning.invalid'+route));
  const redirect=new URL(response.headers.get('location'));
  assert.equal(redirect.pathname,destination);assert.equal(redirect.searchParams.get('next'),route);
}
authenticated=true;
assert.equal((await proxy(new NextRequest('https://learning.invalid/teach/apply'))).status,200);
assert.equal(new URL((await proxy(new NextRequest('https://learning.invalid/sign-up?next=%2Fteach%2Fapply'))).headers.get('location')).pathname,'/teach/apply');
const {AuthForm}=load('app/components/auth/auth-form.tsx');
const html=renderToStaticMarkup(React.createElement(AuthForm,{mode:'sign-up',next:'/teach/apply'}));
assert.match(html,/intent-teach is-selected/);assert.match(html,/auth\.learn/);assert.match(html,/auth\.teach/);
assert.match(html,/href="\/sign-in\?next=%2Fteach%2Fapply"/);
const ordinary=renderToStaticMarkup(React.createElement(AuthForm,{mode:'sign-up',next:'/dashboard'}));
assert.match(ordinary,/intent-learn is-selected/);
const {ApplicationStatus}=load('app/components/instructor/application-status.tsx');
for(const [status,expectedHref] of [[null,'/teach/apply'],['pending',null],['rejected',null],['approved','/dashboard/instructor']]){
  const application=status===null?null:{approval_status:status};
  const statusHtml=renderToStaticMarkup(React.createElement(ApplicationStatus,{application}));
  assert.equal((statusHtml.match(/<h1\b/g)||[]).length,1,`one heading for ${status??'new'} status`);
  const statusHrefs=[...statusHtml.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(statusHrefs,expectedHref?[expectedHref]:[],`status-specific action for ${status??'new'} application`);
}
console.log('PASS: teaching guests enter Create account; existing users continue without signup; other protected routes still use sign-in; both intent choices visible, Teach preselected, safe next preserved. No external requests.');
