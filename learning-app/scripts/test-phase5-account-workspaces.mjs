// Presentation-only fixtures: no database, Auth, Storage or payment requests.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const cache=new Map();
let locale='en', subscriptions=[];
const profile={id:'fixture-only',fullName:'Example learner',email:'example@example.invalid',avatarUrl:null,coverUrl:null,linkedinUrl:null,websiteUrl:null,instagramUrl:null,facebookUrl:null,xUrl:null};
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const mod={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(js,{URL,exports:mod.exports,require(id) {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
    if(id==='next/link') return function MockLink({children,...props}) {const attributes={...props};delete attributes.prefetch;return React.createElement('a',attributes,children);};
    if(id==='next/navigation') return {redirect:()=>{throw Error('Unexpected redirect');},useRouter:()=>({replace:()=>{}}),usePathname:()=>'/dashboard/subscriptions'};
    if(id.endsWith('.module.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(id.endsWith('/language-provider')) return {useLanguage:()=>({locale,t:key=>load('app/lib/i18n.ts').translate(locale,key)})};
    if(id.endsWith('/theme-provider')) return {ThemeContext:React.createContext({theme:'system'})};
    if(id.endsWith('/i18n-server')) return {getRequestLocale:async()=>locale};
    if(id.endsWith('/learning/subscriptions')) return {listOwnLearningSubscriptions:async()=>subscriptions};
    if(id.endsWith('/learning-profile')) return {getOwnLearningProfile:async()=>profile};
    if(id.endsWith('/admin/authorization')) return {isLearningAdmin:async()=>false};
    if(id.endsWith('/instructor/authorization')) return {isApprovedInstructor:async()=>false};
    if(id.endsWith('/instructor/application')) return {getOwnInstructorApplication:async()=>null};
    if(id.endsWith('/instructor/organizations')) return new Proxy({},{get:()=>async()=>[]});
    if(id.endsWith('/supabase/server')) return {createClient:async()=>({storage:{},from(){const query={select(){return query;},order(){return query;},limit(){return Promise.resolve({data:[],error:null});},maybeSingle(){return Promise.resolve({data:null,error:null});}};return query;}})};
    const mockControls={
      '/profile-settings-form':'ProfileSettingsForm','/profile-media-upload-button':'ProfileMediaUploadButton','/profile-social-links-form':'ProfileSocialLinksForm',
      '/auth/delete-account-control':'DeleteAccountControl','/privacy/cookie-settings-button':'CookieSettingsButton','/language-control':'LanguageControl','/theme-control':'ThemeControl',
    };
    for(const [suffix,name] of Object.entries(mockControls)) if(id.endsWith(suffix)) return {[name]:()=>React.createElement('button',{type:'button'},name)};
    if(id.startsWith('@/')||id.startsWith('.')) {const base=id.startsWith('@/')?id.replace('@/',''):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
    return require(id);
  }});cache.set(file,mod.exports);return mod.exports;
}
const logic=load('app/lib/learning/account-workspace.ts');
const summaries=[{id:'1',title:'Analytics',courses:['Spreadsheets'],status:'active',paidThrough:'2026-11-10T00:00:00Z'},{id:'2',title:'Business',courses:[],status:'non_renewing',paidThrough:null},{id:'3',title:'Web',courses:['Design'],status:'expired',paidThrough:'2026-10-01T00:00:00Z'}];
const ids=items=>items.map(item=>item.id).join(',');
assert.equal(ids(logic.filterSubscriptionSummaries(summaries,' SPREADSHEETS ','all','default','en')),'1');
assert.equal(ids(logic.filterSubscriptionSummaries(summaries,'','non_renewing','default','en')),'2');
assert.equal(ids(logic.filterSubscriptionSummaries(summaries,'','all','date','en')),'3,1,2');
assert.equal(ids(logic.filterSubscriptionSummaries(summaries,'','all','name','en')),'1,2,3');
assert.equal(ids(summaries),'1,2,3','Search and sorting must not mutate source');
assert.equal(logic.formatSubscriptionDate('invalid','en'),null);
assert.equal(logic.formatSubscriptionDate(null,'en'),null);
const Subscriptions=load('app/dashboard/subscriptions/page.tsx').default;
const Profile=load('app/dashboard/profile/page.tsx').default;
const Settings=load('app/dashboard/settings/page.tsx').default;
for(locale of ['en','fr','es']) {
  for(const empty of [true,false]) {
    subscriptions=empty?[]:summaries.map(item=>({subscription_id:item.id,plan_name:item.title,subscription_status:item.status,course_titles:item.courses,paid_through:item.paidThrough,amount_minor:10000,currency:'NGN',provider_management_available:false}));
    const html=renderToStaticMarkup(await Subscriptions({searchParams:Promise.resolve({})}));
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.doesNotMatch(html,/NaN|Invalid Date|undefined/);
    if(!empty) {assert.match(html,/type="search"/);assert.equal((html.match(/href="\/api\/payments\/paystack\/subscriptions\/manage/g)||[]).length,1,'Existing active-plan management remains available, expired plans do not gain it');}
  }
  const profileHtml=renderToStaticMarkup(await Profile());
  assert.equal((profileHtml.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(profileHtml,/Growvelt Learning member|Membre Growvelt Learning|Miembro de Growvelt Learning/i,'Profile identity should not repeat the Learning brand above the cover and profile photo');
  assert.match(profileHtml,/href="#profile-identity"/);
  assert.match(profileHtml,/href="#profile-links"/);
  assert.doesNotMatch(profileHtml,/profile-avatar-preview[^>]*aria-hidden/,'Photo upload control must remain accessible');
  assert.doesNotMatch(profileHtml,/Verified email|E-mail vérifié|Correo verificado/,'Do not invent email verification status');
  const settingsHtml=renderToStaticMarkup(await Settings());
  assert.equal((settingsHtml.match(/<h1\b/g)||[]).length,1);
  assert.match(settingsHtml,/type="search"/);
  assert.match(settingsHtml,/CookieSettingsButton/);
  assert.match(settingsHtml,/DeleteAccountControl/);
  assert.match(settingsHtml,/href="\/forgot-password"/);
  assert.match(settingsHtml,/href="\/privacy-policy"/);
  assert.equal((settingsHtml.match(/href="\/dashboard\/profile"/g)||[]).length,1,'Only one profile CTA');
}
const source=fs.readFileSync('app/dashboard/subscriptions/page.tsx','utf8');
assert.match(source,/prefetch=\{false\}/,'Never prefetch the provider-management endpoint');
for(const field of ['ProfileSettingsForm','ProfileMediaUploadButton','ProfileSocialLinksForm','getOwnInstructorOrganizationProfileBranding']) assert.match(fs.readFileSync('app/dashboard/profile/page.tsx','utf8'),new RegExp(field));
console.log('PASS: EN/FR/ES account pages, empty/populated subscriptions, status/search/sort, missing dates, non-mutating filters, original management eligibility, preserved account controls and one heading/profile CTA. No external requests.');
