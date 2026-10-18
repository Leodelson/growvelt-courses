// Isolated logic + server-rendering fixtures. No database, Auth or Storage requests.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
let locale='en';
const cache=new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const mod={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(js,{URL,exports:mod.exports,require(id) {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
    if(id==='next/link') return function MockLink({children,...props}) { const attributes={...props}; delete attributes.prefetch; return React.createElement('a',attributes,children); };
    if(id.endsWith('.module.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(id.endsWith('/language-provider')) return {useLanguage:()=>({locale,t:key=>key})};
    if(id.endsWith('/course-video-cover')) return {CourseVideoCover:()=>null};
    if(id.endsWith('/save-course-button')) return {SaveCourseButton:()=>React.createElement('button',null,'Save')};
    if(id.startsWith('@/')) {const base=id.replace('@/','');return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
    if(id.startsWith('.')) {const base=path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
    return require(id);
  }}); cache.set(file,mod.exports); return mod.exports;
}
const logic=load('app/lib/learning/workspace.ts');
const {LearningLibrary}=load('app/components/learning/learning-library.tsx');
const {SavedCoursesList}=load('app/components/learning/saved-courses-list.tsx');
const {CertificateLibrary}=load('app/components/learning/certificate-library.tsx');
const base={id:1,slug:'analytics',title:'Data Analysis',category:'Data',level:'Beginner',isFree:true,summary:null,instructorName:'Example instructor',enrolledAt:'2026-10-01T12:00:00Z',enrollmentStatus:'active',completedLessons:4,totalLessons:10,progressPercent:40,resumeLessonId:11};
const courses=[base,{...base,id:2,title:'Web Development',category:'Web',slug:'web',completedLessons:0,progressPercent:0,resumeLessonId:null,enrolledAt:'2026-10-02T12:00:00Z'},{...base,id:3,slug:'business',category:'Business',title:'Business',enrollmentStatus:'completed',completedLessons:10,progressPercent:100}];
const ids=(items)=>items.map(item=>item.id).join(',');
assert.equal(ids(logic.filterLearningCourses(courses,'DATA','all','recent')),'1');
assert.equal(ids(logic.filterLearningCourses(courses,'','active','recent')),'1');
assert.equal(ids(logic.filterLearningCourses(courses,'','ready','recent')),'2');
assert.equal(ids(logic.filterLearningCourses(courses,'','completed','recent')),'3');
assert.equal(ids(logic.filterLearningCourses(courses,'','all','progress')),'3,1,2');
assert.equal(logic.learningCourseHref(courses[0]),'/dashboard/my-learning/analytics/lessons/11');
assert.equal(logic.learningCourseHref(courses[2]),'/dashboard/my-learning/business');
assert.equal(logic.courseProgress({...base,progressPercent:130}),100);
assert.equal(courses[0].id,1,'Filtering must not mutate original input');
const saved=courses.map(course=>({...course,providerVerified:false,providerName:null,providerSlug:null,priceAmount:100,priceCurrency:'NGN',averageRating:4,ratingCount:2,isFree:course.id!==2}));
assert.equal(ids(logic.filterSavedCourses(saved,'','', 'paid','saved')),'2');
assert.equal(ids(logic.filterSavedCourses(saved,'Example','Data','all','title')),'1');
const certificate={code:'EXAMPLE-001',courseTitle:'Data Analysis',learnerName:'Example learner',completedAt:base.enrolledAt,issuedAt:base.enrolledAt,status:'issued'};
for(locale of ['en','fr','es']) for(const empty of [false,true]) {
  for(const [Component,props] of [[LearningLibrary,{courses:empty?[]:courses}],[SavedCoursesList,{courses:empty?[]:saved}],[CertificateLibrary,{certificates:empty?[]:[certificate,{...certificate,code:'EXAMPLE-002',status:'revoked'}],completedCourses:empty?[]:[courses[2]]}]]) {
    const html=renderToStaticMarkup(React.createElement(Component,props));
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.doesNotMatch(html,/NaN|undefined|Invalid Date/);
    if(!empty) assert.match(html,/type="search"/);
    if(Component===CertificateLibrary&&!empty) {
      assert.equal((html.match(/<button[^>]*class="quietButton"/g)||[]).length,1,'Only issued records offer copying');
      assert.match(html,/\/verify-certificate\/EXAMPLE-001/);
      assert.match(html,/\/dashboard\/my-learning\/business/);
    }
  }
}
console.log('PASS: learner search/status/sort, resume vs completed routes, non-mutating filters, saved access/subject filters, EN/FR/ES populated/empty rendering, one page heading, issued-only sharing and completed-course shortcuts. No external requests.');
