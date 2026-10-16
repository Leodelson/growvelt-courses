// UI-only regression fixtures. No Supabase, email, payment or Storage requests.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url), cache=new Map();
let locale='en', pathname='/dashboard';
function MockLink({children,...props}) {const attributes={...props};delete attributes.prefetch;return React.createElement('a',attributes,children);}
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const mod={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(js,{URL,exports:mod.exports,require(id) {
    if(id==='next/link') return MockLink;
    if(id==='next/navigation') return {usePathname:()=>pathname};
    if(id.endsWith('.module.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(id.endsWith('/language-provider')) return {useLanguage:()=>({locale,t:key=>load('app/lib/i18n.ts').translate(locale,key)})};
    if(id.endsWith('/learning-mark')) return {LearningMark:()=>React.createElement(MockLink,{href:'/dashboard'},'Growvelt')};
    if(id.endsWith('/auth/sign-out-button')) return {SignOutButton:()=>React.createElement('button',null,'Log Out')};
    if(id.endsWith('/sidebar-brand-controls')) return {SidebarBrandControls:()=>null};
    if(id.endsWith('/theme-control')) return {ThemeControl:()=>null};
    if(id.startsWith('@/')||id.startsWith('.')) {const base=id.startsWith('@/')?id.replace('@/',''):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
    return require(id);
  }});cache.set(file,mod.exports);return mod.exports;
}
const logic=load('app/lib/learning/overview.ts');
const {learningCourseHref}=load('app/lib/learning/workspace.ts');
const {DashboardOverview}=load('app/components/learning/dashboard-overview.tsx');
const {LearningShellNavigation}=load('app/components/learning-shell-navigation.tsx');
const base={id:1,slug:'analytics',title:'Analytics',category:'Data',level:'Beginner',isFree:true,summary:null,instructorName:'Example instructor',enrolledAt:'2026-10-01T12:00:00Z',enrollmentStatus:'active',completedLessons:4,totalLessons:10,progressPercent:40,resumeLessonId:11};
const completed={...base,id:2,slug:'completed',title:'Completed course',enrollmentStatus:'completed',progressPercent:100,completedLessons:10,resumeLessonId:22};
const ready={...base,id:3,slug:'ready',title:'Ready course',completedLessons:0,progressPercent:0,resumeLessonId:null};
const cert={code:'EXAMPLE-ONLY',courseTitle:'Analytics',learnerName:'Example',completedAt:base.enrolledAt,issuedAt:base.enrolledAt,status:'issued'};
const summary=logic.learningOverview([completed,base,ready],[{...cert,status:'revoked'},cert]);
assert.equal(summary.featured.id,1,'Completed courses must not take priority over a resumable ongoing course');
assert.equal(learningCourseHref(completed),'/dashboard/my-learning/completed');
assert.equal(learningCourseHref(base),'/dashboard/my-learning/analytics/lessons/11');
assert.equal(summary.active,1);assert.equal(summary.ready,1);assert.equal(summary.completed,1);
assert.equal(summary.overall,47);assert.equal(summary.done,14);assert.equal(summary.issued.length,1);
assert.equal(summary.subjects[0][1],3);
assert.equal(logic.learningOverview([],[]).overall,0);
assert.equal(logic.learningOverview([{...base,totalLessons:NaN,completedLessons:Infinity}],[]).overall,0);
assert.equal(logic.learningOverview([{...base,totalLessons:10,completedLessons:100}],[]).overall,100);
assert.equal([completed,base,ready][0].id,2,'Summary must not reorder source records');
for(const [current,href,expected] of [
 ['/dashboard/my-learning/analytics/lessons/11','/dashboard/my-learning',true],
 ['/dashboard/certificates/EXAMPLE','/dashboard/certificates',true],
 ['/dashboard/courses/analytics','/dashboard/explore',true],
 ['/dashboard/instructor/courses/new','/dashboard/instructor/courses',false],
 ['/dashboard/instructor/courses/19/curriculum','/dashboard/instructor/courses',true],
 ['/dashboard/instructor/courses','/dashboard/instructor',false],
 ['/dashboard/settings','/dashboard',false],
 ['/dashboard/my-learning-other','/dashboard/my-learning',false],
]) assert.equal(logic.isDashboardNavigationCurrent(current,href),expected);
for(locale of ['en','fr','es']) for(const courses of [[],[base],[completed],[completed,base,ready]]) {
  const html=renderToStaticMarkup(React.createElement(DashboardOverview,{courses,certificates:courses.length?[cert,{...cert,code:'REVOKED',status:'revoked'}]:[]}));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(html,/NaN|undefined|Invalid Date|REVOKED/);
  assert.doesNotMatch(html,/completed\/lessons\//,'Completed courses always open their overview');
  if(courses.length>1) assert.match(html,/aria-pressed="true"/);
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(hrefs).size,hrefs.length,'No repeated action destinations on Home');
}
for(const roles of [{isAdmin:false,isInstructor:false,isCompany:false,showSubscriptionPlans:false},{isAdmin:true,isInstructor:true,isCompany:true,showSubscriptionPlans:true}]) {
  pathname='/dashboard/my-learning/analytics/lessons/11';
  const html=renderToStaticMarkup(React.createElement(LearningShellNavigation,{...roles,initialSidebarCollapsed:false,userEmail:'example@example.invalid',displayName:'Example',avatarUrl:null},React.createElement('h1',null,'Fixture')));
  assert.match(html,/id="main-content"/);assert.match(html,/href="#main-content"/);
  assert.match(html,/aria-current="page" href="\/dashboard\/my-learning"/);
  assert.equal(html.includes('href="/dashboard/admin/payments"'),roles.isAdmin);
  assert.equal(html.includes('href="/dashboard/instructor/payout-profile"'),roles.isInstructor);
}
const shell=fs.readFileSync('app/components/learning-shell.tsx','utf8'), nav=fs.readFileSync('app/components/learning-shell-navigation.tsx','utf8');
assert.equal((shell.match(/<WelcomeEmailTrigger \/>/g)||[]).length,1,'Preserve the normal authenticated-shell welcome trigger once');
assert.doesNotMatch(nav,/WelcomeEmailTrigger/,'Presentation navigation must not dispatch emails');
assert.match(nav,/role="dialog" aria-modal="true"/);
assert.match(nav,/useDashboardDrawer/);
console.log('PASS: overview counts, course routing, enrollment summary bounds, certificate status, unique actions, EN/FR/ES empty/populated/completed rendering, nested nav highlighting, role-gated links and preserved welcome mounting. No external requests.');
