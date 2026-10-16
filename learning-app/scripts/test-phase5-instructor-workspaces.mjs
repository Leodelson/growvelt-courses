// Presentation-only regression fixtures. No backend or provider requests.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
let locale='en',approved=true,enabled=true,empty=false,courseStatus='draft',foundation=true;
const course={course_id:12,title:'Example analytics course',summary:'A practical course summary',description:'A practical course description with at least forty characters.',category:'Data',level:'Beginner',is_free:true,price_amount:0,price_currency:'NGN',status:'draft',slug:'example',updated_at:'2026-10-01T00:00:00Z',company_test_mode_only:false};
const lesson={id:1,title:'A video',type:'video',content:null,videoProvider:'youtube',videoReference:'abcdefghijk',videoVisibility:'unlisted',durationSeconds:120,isPreview:false,position:1};
const modules=[{id:1,title:'Getting started',position:1,lessons:[lesson,{...lesson,id:2,type:'text',durationSeconds:null}]}];
const planCourse={course_id:12,title:'Example paid course',price_amount:100,currency:'NGN',commercial_terms_version:'same-terms',company_test_mode_only:false};
const plan={plan_id:'example-plan',name:'Example Test plan',description:null,amount_minor:10000,currency:'NGN',billing_interval:'monthly',status:'draft',course_ids:[12],course_titles:['Example paid course'],created_at:'2026-10-01',updated_at:'2026-10-01'};
function load(file) {
 if(cache.has(file))return cache.get(file);const mod={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{URL,exports:mod.exports,require(id){
  if(id==='next/link')return function MockLink({children,...props}){const attributes={...props};delete attributes.prefetch;return React.createElement('a',attributes,children);};
  if(id==='next/navigation')return {useRouter:()=>({refresh:()=>{},replace:()=>{}}),notFound:()=>{throw Error('NOT_FOUND');},redirect:()=>{throw Error('REDIRECT');}};
  if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  if(id.endsWith('/language-provider'))return {useLanguage:()=>({locale,t:key=>load('app/lib/i18n.ts').translate(locale,key)})};
  if(id.endsWith('/i18n-server'))return {getRequestLocale:async()=>locale};
  if(id.endsWith('/instructor/authorization'))return {isApprovedInstructor:async()=>approved};
  if(id.endsWith('/instructor/analytics'))return {getOwnInstructorLearningAnalytics:async()=>({courses:empty?[]:[{courseId:12,title:course.title,status:courseStatus,enrolledLearnerCount:2,activeLearnerCount:1,completedLearnerCount:1,completionRate:50,quizCount:0}],totalEnrolledLearners:empty?0:2,totalCompletedLearners:empty?0:1,overallCompletionRate:empty?0:50,totalQuizAttempts:0})};
  if(id.endsWith('/instructor/courses'))return {getOwnInstructorCourse:async()=>({...course,status:courseStatus}),searchOwnInstructorCourses:async()=>({courses:empty?[]:[{...course,status:courseStatus}],total:empty?0:1,page:1,pageSize:12})};
  if(id.endsWith('/instructor/curriculum'))return {getOwnInstructorCurriculum:async()=>empty?[]:modules};
  if(id.endsWith('/instructor/organizations'))return {getOwnInstructorOrganizations:async()=>[]};
  if(id.endsWith('/instructor/subscription-plans'))return {getOwnInstructorSubscriptionPlanData:async()=>({available:foundation,courses:empty?[]:[planCourse],plans:empty?[]:[plan],provisioning:[]})};
  if(id.endsWith('/subscriptions/feature'))return {areLearningSubscriptionPlansEnabled:()=>enabled,canProvisionTestSubscriptionPlans:()=>true};
  if(id.endsWith('/instructor/subscriptions/actions'))return {createOwnSubscriptionPlan:async()=>{throw Error('Unexpected write');},provisionOwnTestSubscriptionPlan:async()=>{throw Error('Unexpected provider write');}};
  if(id.endsWith('/supabase/browser'))return {createClient:()=>{throw Error('Unexpected backend call');}};
  if(id.endsWith('/supabase/server'))return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'fixture'}}})}})};
  if(id.endsWith('/course-video-cover-upload'))return {CourseVideoCoverUpload:()=>null};
  if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?id.replace('@/',''):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
  return require(id);
 }});cache.set(file,mod.exports);return mod.exports;
}
const logic=load('app/lib/instructor/workbench.ts');
const list=[{id:'a',title:'Analytics',keywords:'Spreadsheets',status:'draft',metric:2},{id:'b',title:'Business',keywords:'Writing',status:'published',metric:8}];
assert.equal(logic.filterWorkbench(list,' SPREADSHEETS ','all','default','en')[0].id,'a');
assert.equal(logic.filterWorkbench(list,'','published','title','en')[0].id,'b');
assert.equal(logic.filterWorkbench(list,'','all','metric','en')[0].id,'b');assert.equal(list[0].id,'a');
assert.deepEqual(Array.from(logic.draftDetailChecks({title:'AB',summary:'short',description:'short'},false,0)),[false,false,false,false]);
assert.deepEqual(Array.from(logic.draftDetailChecks({title:course.title,summary:course.summary,description:course.description},true,null)),[true,true,true,true]);
const snapshot=logic.curriculumSnapshot(modules);assert.equal(snapshot.modules,1);assert.equal(snapshot.lessons,2);assert.equal(snapshot.videoMinutes,2);assert.equal(snapshot.quizzes,0);
assert.equal(logic.curriculumSnapshot([{...modules[0],lessons:[{...lesson,durationSeconds:Infinity}]}]).videoMinutes,0);
const pages=['app/dashboard/instructor/page.tsx','app/dashboard/instructor/courses/page.tsx','app/dashboard/instructor/courses/new/page.tsx','app/dashboard/instructor/courses/[courseId]/page.tsx','app/dashboard/instructor/courses/[courseId]/curriculum/page.tsx','app/dashboard/instructor/subscriptions/page.tsx'].map(file=>load(file).default);
for(locale of ['en','fr','es'])for(empty of [false,true])for(const Page of pages){
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({}),params:Promise.resolve({courseId:'12'})}));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.doesNotMatch(html,/NaN|undefined|Invalid Date/);
 if(Page===pages[4]&&!empty){assert.match(html,/href="#curriculum-module-1"/);assert.match(html,/id="curriculum-module-1"/);}
 if(Page===pages[3]){assert.match(html,/minlength="3"/i);assert.match(html,/name="title"/);assert.match(html,/course-submission-panel/);}
 if(Page===pages[5]&&!empty){assert.match(html,/Create Test Mode plan/);assert.match(html,/name="course_ids"/);}
}
empty=false;courseStatus='published';
for(const Page of [pages[3],pages[4]]) {const html=renderToStaticMarkup(await Page({params:Promise.resolve({courseId:'12'})}));assert.match(html,/<fieldset disabled=""/);assert.doesNotMatch(html,/course-submission-panel/);}
approved=false;await assert.rejects(()=>pages[0](),/REDIRECT/);await assert.rejects(()=>pages[5](),/REDIRECT/);approved=true;enabled=false;await assert.rejects(()=>pages[5](),/NOT_FOUND/);enabled=true;foundation=false;
const unavailable=renderToStaticMarkup(await pages[5]());assert.match(unavailable,/foundation is not ready/);assert.doesNotMatch(unavailable,/name="monthly_price"/);
const form=fs.readFileSync('app/components/instructor/subscription-plan-form.tsx','utf8');
assert.match(form,/courses\.map\(\(course\)/,'Keep selected checkbox controls mounted when searching');assert.match(form,/hidden=\{!matchesSearch\(course.title\)\}/);assert.match(form,/termVersions.size > 1/);assert.match(form,/courseTypes.size > 1/);assert.match(form,/selectedIds.length >= 50 && !selectedIds.includes/);
const draft=fs.readFileSync('app/components/instructor/course-draft-form.tsx','utf8');assert.match(draft,/isPending \|\| !isEditable/);assert.match(draft,/create_learning_organization_course_draft/);assert.match(draft,/set_own_learning_course_company_test_mode/);
console.log('PASS: six instructor pages in EN/FR/ES, empty/populated states, readonly curriculum/details, field constraints, approval/feature/foundation guards, checklist counts, module anchors, list filtering and preserved subscription selection restrictions. No backend writes.');
