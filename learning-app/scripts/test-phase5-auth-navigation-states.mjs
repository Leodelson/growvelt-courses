// UI-only fixtures: no authentication, sign-out or provider writes.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();let locale='en',drawerOpen=false;
function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{URL,URLSearchParams,process:{env:{}},exports:mod.exports,require(id){
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
 if(id==='react')return {...React,useState(initial){return React.useState(drawerOpen&&initial===null?'mobile':initial);}};
 if(id==='next/link')return ({children,...props})=>React.createElement('a',props,children);
 if(id==='next/image')return ({priority,...props})=>React.createElement('img',props);
 if(id==='next/navigation')return {usePathname:()=>'/dashboard/admin',useRouter:()=>({refresh(){}})};
 if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
 if(id.endsWith('/language-provider'))return {useLanguage:()=>({locale,setLocale(){},t:key=>load('app/lib/i18n.ts').translate(locale,key)})};
 if(id.endsWith('/i18n-server'))return {getRequestLocale:async()=>locale};
 if(id.endsWith('/learning-mark'))return {LearningMark:({href})=>React.createElement('a',{href},'Growvelt')};
 if(id.endsWith('/sidebar-brand-controls'))return {SidebarBrandControls:()=>null};
 if(id.endsWith('/public-header'))return {PublicHeader:()=>null};
 if(id.endsWith('/FooterWrapper'))return {__esModule:true,default:()=>null};
 if(id.endsWith('/theme-control'))return {ThemeControl:()=>React.createElement('div',{className:'theme-control'},'Theme')};
 if(id.endsWith('/use-dashboard-drawer'))return {useDashboardDrawer(){}};
 if(id.endsWith('/turnstile-widget'))return {TurnstileWidget:({action})=>React.createElement('div',{'data-captcha-action':action},'Verification placeholder')};
 if(id.endsWith('/auth/turnstile'))return {verifyTurnstileToken(){throw Error('Unexpected verification');}};
 if(id.endsWith('/supabase/browser'))return {createClient(){throw Error('Unexpected backend');}};
 if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?id.slice(2):path.resolve(path.dirname(file),id);return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}return require(id);
 }});cache.set(file,mod.exports);return mod.exports;}
const Shell=load('app/components/learning-shell-navigation.tsx').LearningShellNavigation;
for(const role of ['learner','instructor','admin','combined']){
 drawerOpen=true;const html=renderToStaticMarkup(React.createElement(Shell,{isInstructor:role==='instructor'||role==='combined',isAdmin:role==='admin'||role==='combined',isCompany:role==='combined',showSubscriptionPlans:true,initialSidebarCollapsed:false,userEmail:'example@example.invalid',displayName:'Example',avatarUrl:null},React.createElement('h1',null,'Example workspace')));
 assert.match(html,/class="mobile-nav" hidden=""/);assert.match(html,/class="drawerFooter"/);assert.match(html,/lucide-log-out/);
 const body=html.split('class="mobile-dashboard-workspaces"')[1].split('</footer>')[0],hrefs=[...body.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);assert.equal(hrefs.length,new Set(hrefs).size,role+' duplicate drawer destination');
 assert.ok(hrefs.includes('/dashboard'));assert.ok(hrefs.includes('/dashboard/my-learning'));assert.ok(hrefs.includes('/dashboard/explore'));assert.ok(hrefs.includes('https://www.growvelt.com/'));
 assert.equal(hrefs.includes('/dashboard/admin/payments'),role==='admin'||role==='combined');assert.equal(hrefs.includes('/dashboard/instructor/courses'),role==='instructor'||role==='combined');
 if(role==='instructor'||role==='combined'){assert.ok(hrefs.includes('/dashboard/instructor/courses/new'));assert.ok(hrefs.includes('/dashboard/instructor/earnings'));}
}
drawerOpen=false;
const Frame=load('app/components/auth/auth-frame.tsx').AuthFrame,Form=load('app/components/auth/auth-form.tsx').AuthForm,Passwords=load('app/components/auth/password-forms.tsx');
for(locale of ['en','fr','es']){
 for(const mode of ['sign-in','sign-up']){const html=renderToStaticMarkup(React.createElement(Frame,null,React.createElement(Form,{mode,next:'/teach/apply'})));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/id="account-form-area"/);assert.match(html,/name="password"/);assert.match(html,/name="email"/);assert.match(html,/next=%2Fteach%2Fapply/);assert.match(html,new RegExp('data-captcha-action="'+mode.replace('-','_')+'"'));if(mode==='sign-up'){assert.match(html,/name="password_confirmation"/);assert.match(html,/aria-pressed="true"/);}}
 for(const Component of [Passwords.ForgotPasswordForm,Passwords.ResetPasswordForm]){const html=renderToStaticMarkup(React.createElement(Frame,null,React.createElement(Component)));assert.equal((html.match(/<h1\b/g)||[]).length,1);}
 for(const file of ['app/(auth)/check-email/page.tsx','app/auth/error/page.tsx']){const Page=load(file).default;const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({next:'/teach/apply'})}));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/href="\/sign-in/);}
 const ErrorState=load('app/components/ui/route-error.tsx').RouteError;const html=renderToStaticMarkup(React.createElement(ErrorState,{title:'Example unavailable state',description:'No private details are shown.',reset(){},recoveryHref:'/dashboard',recoveryLabel:'Workspace'}));assert.match(html,/role="alert"/);assert.match(html,/href="\/dashboard"/);assert.doesNotMatch(html,/stack|digest|Error:/);
}
const loader=renderToStaticMarkup(React.createElement(load('app/components/ui/workspace-loading.tsx').WorkspaceLoading,{label:'Loading workspace'}));assert.match(loader,/aria-busy="true"/);assert.match(loader,/role="status"/);
function filesUnder(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesUnder(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const files=filesUnder('app').filter(file=>!file.includes('ui-review'));
for(const file of files.filter(file=>file.endsWith('not-found.tsx'))){const Page=load(file).default,html=renderToStaticMarkup(await Page());assert.equal((html.match(/<h1\b/g)||[]).length,1,file);assert.match(html,/href="\//,file);assert.match(html,/route-feedback-panel/,file);}
for(const file of files.filter(file=>file.endsWith('loading.tsx'))){const source=fs.readFileSync(file,'utf8');assert.match(source,/aria-busy|role="status"|WorkspaceLoading|export.*from/,file);}
console.log('PASS: four unique role menus, hidden bottom bar, logout icon, six auth pages/one h1, onboarding/fields/CAPTCHA, all not-found panels and loading status contracts. No requests or writes.');
