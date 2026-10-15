// Render-only fixtures. No network, Auth, Storage or database writes.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let locale = 'en';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const source = fs.readFileSync(file,'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  vm.runInNewContext(js,{URLSearchParams,exports:mod.exports,require(id) {
    if (id.endsWith('.module.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if (id === 'next/link') return function MockLink({children,...props}) { return React.createElement('a',props,children); };
    if (id === 'next/navigation') return {useRouter:()=>({replace(){}})};
    if (id.endsWith('/language-provider') || id === './language-provider') return {useLanguage:()=>({locale,t:key=>key})};
    if (id.endsWith('/i18n-server')) return {getRequestLocale:async()=>locale};
    if (id.endsWith('/rating-actions')) return {saveCourseRating:()=>{throw Error('No writes allowed in presentation tests');}};
    if (id.endsWith('/save-course-button')) return {SaveCourseButton:()=>React.createElement('button',null,'Save course')};
    if (id.endsWith('/course-video-cover') || id === './course-video-cover') return {CourseVideoCover:()=>null};
    if (id.startsWith('@/')) return load(id.replace('@/', '')+(id.endsWith('.tsx')||id.endsWith('.ts')?'':fs.existsSync(id.replace('@/','')+'.tsx')?'.tsx':'.ts'));
    if (id.startsWith('.')) { const base=path.resolve(path.dirname(file),id); return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts')); }
    return require(id);
  }});
  cache.set(file,mod.exports); return mod.exports;
}
const render = (component, props)=>renderToStaticMarkup(React.createElement(component,props));
const {PublishedCourseCard}=load('app/components/published-course-card.tsx');
const {CourseRatingForm}=load('app/components/learning/course-rating-form.tsx');
const {PublicCatalog}=load('app/components/public-catalog.tsx');
const {CourseDetailHeader}=load('app/components/course-detail-header.tsx');
const {coursePresentationCopy}=load('app/lib/catalog/course-presentation-copy.ts');
const course={id:1,slug:'test-course',title:'Practical analysis <script>',summary:'A course summary',category:'Data Analytics',level:'Beginner',isFree:false,priceAmount:100,priceCurrency:'NGN',instructorName:'Example instructor',providerVerified:false,providerName:null,providerSlug:null,averageRating:4.5,ratingCount:2,modules:[]};
for(locale of ['en','fr','es']) {
  const card=render(PublishedCourseCard,{course,index:0});
  assert.match(card,/4\.5/); assert.ok(card.includes('2 '+coursePresentationCopy[locale].ratings));
  assert.match(card,/&lt;script&gt;/); assert.doesNotMatch(card,/<script>/);
  const unrated=render(PublishedCourseCard,{course:{...course,ratingCount:0,averageRating:null},index:0});
  assert.ok(unrated.includes(coursePresentationCopy[locale].noRatings)); assert.doesNotMatch(unrated,/4\.5/);
  const form=render(CourseRatingForm,{courseId:1,initialRating:3});
  assert.equal((form.match(/type="radio"/g)||[]).length,5); assert.match(form,/<input[^>]*checked=""[^>]*value="3"/);
  assert.match(form,/role="status"/);
  const hero=renderToStaticMarkup(await CourseDetailHeader({course}));
  assert.equal((hero.match(/<h1/g)||[]).length,1);
  for(const anchor of ['course-about','course-outline','course-access','course-recommendations']) assert.ok(hero.includes(`href="#${anchor}"`));
  const query={query:'',category:'',level:'',access:'all',sort:'newest',page:1};
  const courses=[course,{...course,id:2,slug:'design',category:'Creative Skills'}];
  for(const dashboard of [false,true]) {
    const html=render(PublicCatalog,{catalog:{courses,total:2,pageSize:12},query,authenticated:dashboard,dashboard,basePath:dashboard?'/dashboard/explore':'/learn'});
    assert.equal((html.match(/<article /g)||[]).length,2,'Every course appears once');
    assert.equal((html.match(/class="shelf"/g)||[]).length,1,'Small catalog uses one populated shelf');
    assert.ok(html.includes(`href="${dashboard?'/dashboard/courses':'/courses'}/test-course"`));
  }
}
console.log('PASS: EN/FR/ES; compact cards, true ratings and unrated states, escaped content, accessible 5-star form, course anchors, shared catalogs, context routes and sparse-catalog grouping. No external requests.');
