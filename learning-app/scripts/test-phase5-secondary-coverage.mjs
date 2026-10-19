// Render actual pages with isolated dependencies; no network or database writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let response = { data: [], error: null }, locale = 'en';
const anchor = ({children, ...props}) => React.createElement('a', props, children);
function load(file) {
  const mod = {exports: {}};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  vm.runInNewContext(js, {exports: mod.exports, require(id) {
    if (id.endsWith('.module.css')) return {__esModule:true, default: new Proxy({}, {get:(_,key)=>String(key)})};
    if (id === 'next/link' || id.endsWith('/learning-link')) return anchor;
    if (id === 'next/image') return ({priority, ...props}) => React.createElement('img', props);
    if (id.endsWith('/public-header')) return {PublicHeader:()=>React.createElement('a',{href:'#public-main'},'Skip to content')};
    if (id.endsWith('/FooterWrapper')) return () => null;
    if (id.endsWith('/learning-mark')) return {LearningMark:()=>null};
    if (id.endsWith('/i18n-server')) return {getRequestLocale:async()=>locale};
    if (id.endsWith('/supabase/server')) return {createClient:async()=>({rpc:async(name)=>{assert.equal(name,'verify_learning_certificate');return response;}})};
    if (id.endsWith('/verified-provider-badge')) return {VerifiedProviderBadge:()=>null};
    return require(id);
  }});
  return mod.exports;
}
const verify = load('app/verify-certificate/[code]/page.tsx').default;
const renderVerify = async()=>renderToStaticMarkup(await verify({params:Promise.resolve({code:'EXAMPLE'})}));
for (locale of ['en','fr','es']) {
  response = {data:[],error:null};
  let html = await renderVerify();
  assert.match(html,/verification-missing/);
  assert.doesNotMatch(html,/<dl>/);
  for (const valid of [true,false]) {
    response = {data:[{is_valid:valid,course_title:'Example course',certificate_code:'EXAMPLE',learner_name:'Example learner'}],error:null};
    html = await renderVerify();
    assert.match(html,valid?/verification-valid/:/verification-revoked/);
    assert.match(html,/Example learner/);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
  }
}
response = {data:null,error:{message:'Internal provider error'}};
await assert.rejects(renderVerify,/temporarily unavailable/);
for (const file of ['app/certificates/page.tsx','app/company-learning/page.tsx']) {
  const html=renderToStaticMarkup(React.createElement(load(file).default));
  assert.match(html,/id="public-main"/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(html,/Phase 1A|arrive in the next phase|future certificate experience/);
}
console.log('PASS: valid/revoked/missing certificate states in three locales; lookup errors reach recovery instead of claiming a missing certificate; public pages have a working skip target and one heading. No external requests.');
