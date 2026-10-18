// Presentation-only fixtures. All admin readers are mocked; no review is submitted.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
let locale='en',admin=true,empty=false,finalized=false,missingQuiz=false;
const userId='00000000-0000-4000-8000-000000000001';
const application={user_id:userId,full_name:'Example Applicant',email:'applicant@example.invalid',country:'Example country',headline:'Practical skills instructor',expertise:['Spreadsheets'],years_experience:4,bio:'Example professional background.',teaching_experience:'Example teaching experience.',motivation:'Example teaching motivation.',created_at:'invalid-date',approval_status:'pending'};
const textLesson={id:1,title:'First text lesson',type:'text',content:'Submitted example content.',isPreview:false,quiz:null};
const quiz={id:1,instructions:'Choose one answer.',passingPercentage:80,questions:[{id:1,text:'Example question?',options:[{id:1,text:'First answer',isCorrect:true},{id:2,text:'Second answer',isCorrect:false}]}]};
const course={courseId:7,title:'Submitted spreadsheet course',summary:'A practical course outcome.',description:'Example detailed submitted description.',category:'Business',level:'Beginner',isFree:false,priceCurrency:'NGN',priceAmount:100,companyTestModeOnly:true,submittedAt:'invalid-date',instructor:{name:'Example Instructor',email:'instructor@example.invalid'},declaration:{version:'example-v1',basis:'original',acceptedAt:'invalid-date'},modules:[{id:1,title:'Getting started',lessons:[textLesson,{...textLesson,id:2,title:'Check your knowledge',type:'quiz',content:null,quiz}]}]};
const provider={organization_id:3,organization_name:'Example Academy',organization_slug:'example-academy',legal_name:'Example Training Organization',contact_email:'provider@example.invalid',website_url:'https://example.invalid',submitted_by_name:'Example Owner',submitted_by_email:'owner@example.invalid',submitted_at:'invalid-date',verification_statement:'Example statement submitted by an organization owner.'};
function guard(){if(!admin)throw Error('ADMIN_REQUIRED');}
function load(file){
 if(cache.has(file))return cache.get(file);const mod={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{URL,URLSearchParams,exports:mod.exports,require(id){
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
  if(id==='next/link')return ({children,...props})=>React.createElement('a',props,children);
  if(id==='next/navigation')return {redirect(){throw Error('REDIRECT');},notFound(){throw Error('NOT_FOUND');},useRouter:()=>({push(){},refresh(){}})};
  if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  if(id.endsWith('/i18n-server'))return {getRequestLocale:async()=>locale};
  if(id.endsWith('/language-provider'))return {useLanguage:()=>({locale,t:key=>load('app/lib/i18n.ts').translate(locale,key)})};
  if(id.endsWith('/admin/authorization'))return {isLearningAdmin:async()=>admin};
  if(id.endsWith('/admin/instructor-applications'))return {searchPendingInstructorApplications:async()=>{guard();return {applications:empty?[]:[application],total:empty?0:24,page:1,pageSize:12};},getInstructorApplicationForAdmin:async()=>{guard();return empty?null:{...application,approval_status:finalized?'approved':'pending',review_note:finalized?'Example recorded decision.':null};}};
  if(id.endsWith('/admin/course-moderation'))return {searchPendingLearningCourses:async()=>{guard();return {courses:empty?[]:[{course_id:7,course_title:course.title,instructor_name:course.instructor.name,category:course.category,level:course.level,is_free:false,price_amount:100,price_currency:'NGN',submitted_at:'invalid-date'}],total:empty?0:24,page:1,pageSize:12};},getLearningCourseForReview:async()=>{guard();return empty?null:{...course,modules:[{...course.modules[0],lessons:[textLesson,{...course.modules[0].lessons[1],quiz:missingQuiz?null:quiz}]}]};}};
  if(id.endsWith('/admin/provider-verifications'))return {getPendingProviderVerifications:async()=>{guard();return empty?[]:[provider];}};
  if(id.endsWith('/course-video-cover'))return {CourseVideoCover:()=>React.createElement('span',null,'Example cover placeholder')};
  if(id.endsWith('/supabase/browser'))return {createClient(){throw Error('Unexpected backend call');}};
  if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?id.replace('@/',''):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
  return require(id);
 }});cache.set(file,mod.exports);return mod.exports;
}
const logic=load('app/lib/admin/review-presentation.ts');
assert.equal(logic.reviewDate(null,'en'),'Date unavailable');assert.equal(logic.reviewDate('invalid','en'),'Date unavailable');
const items=[{id:'a',title:'Academy',keywords:'training',group:'review',submittedAt:'2026-10-01'},{id:'b',title:'Billing',group:'business',submittedAt:'2026-10-02'},{id:'c',title:'Missing date',group:'review',submittedAt:'invalid'}];
assert.equal(logic.filterReviewItems(items,' TRAINING ','all','default','en')[0].id,'a');
assert.equal(logic.filterReviewItems(items,'','business','name','en')[0].id,'b');
assert.equal(logic.filterReviewItems(items,'','all','newest','en')[0].id,'b');
assert.equal(logic.filterReviewItems(items,'','all','oldest','en')[2].id,'c');assert.equal(items[0].id,'a');
const files=['page.tsx','instructors/page.tsx','instructors/[userId]/page.tsx','courses/page.tsx','courses/[courseId]/page.tsx','providers/page.tsx'];
const pages=files.map(file=>load('app/dashboard/admin/'+file).default);
const args=()=>({searchParams:Promise.resolve({}),params:Promise.resolve({userId,courseId:'7'})});
for(locale of ['en','fr','es'])for(const Page of pages){const html=renderToStaticMarkup(await Page(args()));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.doesNotMatch(html,/NaN|undefined|Invalid Date/);}
locale='en';
const hub=renderToStaticMarkup(await pages[0](args()));assert.equal((hub.match(/class="admin-operation-card"/g)||[]).length,8);
const detail=renderToStaticMarkup(await pages[4](args()));
for(const anchor of ['review-overview','review-rights','review-curriculum','review-decision','review-module-1']){assert.match(detail,new RegExp(`href="#${anchor}"`));assert.match(detail,new RegExp(`id="${anchor}"`));}
assert.match(detail,/First answer/);assert.match(detail,/Correct answer/);assert.match(detail,/Paystack Test Mode only/);
missingQuiz=true;assert.match(renderToStaticMarkup(await pages[4](args())),/Quiz structure is unavailable/);missingQuiz=false;
finalized=true;assert.doesNotMatch(renderToStaticMarkup(await pages[2](args())),/Internal review note/);finalized=false;
empty=true;for(const Page of [pages[1],pages[3],pages[5]])assert.match(renderToStaticMarkup(await Page(args())),/admin-empty-state/);
for(const Page of [pages[2],pages[4]])await assert.rejects(()=>Page(args()),/NOT_FOUND/);empty=false;
await assert.rejects(()=>pages[2]({params:Promise.resolve({userId:'bad'})}),/NOT_FOUND/);
await assert.rejects(()=>pages[4]({params:Promise.resolve({courseId:'0'})}),/NOT_FOUND/);
admin=false;await assert.rejects(()=>load('app/dashboard/admin/layout.tsx').default({children:null}),/REDIRECT/);
for(const Page of [pages[3],pages[4]])await assert.rejects(()=>Page(args()),/REDIRECT/);
for(const Page of [pages[1],pages[2],pages[5]])await assert.rejects(()=>Page(args()),/ADMIN_REQUIRED/);
const providerForm=fs.readFileSync('app/components/admin/provider-verification-review-form.tsx','utf8');
assert.match(providerForm,/note.trim\(\).length < 10/);assert.match(providerForm,/requestDecision\("verified"\)/);assert.match(providerForm,/<ConfirmationDialog/);
assert.match(providerForm,/review\(confirmation\)/);assert.match(providerForm,/credentials: "same-origin"/);
const collection=fs.readFileSync('app/components/admin/review-collection.tsx','utf8');assert.match(collection,/hidden=\{!ids.has\(item.id\)\}/);assert.match(collection,/key=\{item.id\}/);
console.log('PASS: six admin review pages, EN/FR/ES, pending/finalized/empty/invalid states, admin guards, quiz/test-only warnings, anchors, date/filter logic and confirmation wiring. No external requests.');
