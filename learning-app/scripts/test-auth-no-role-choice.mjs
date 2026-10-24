import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=fs.readFileSync('app/components/auth/learning-google-one-tap.tsx','utf8');
assert.doesNotMatch(source,/chooseIntent|showRoleChoice|updateUser|growvelt_learning_intent|role="dialog"/);
for(const existing of [false,true]){
  const callbacks=[], routes=[], removed=[], requests=[];
  const module={exports:{}};
  const window={sessionStorage:{removeItem:key=>removed.push(key)},google:{accounts:{id:{initialize:options=>callbacks.push(options),prompt(){}}}}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports:module.exports,window,crypto:globalThis.crypto,TextEncoder,btoa,Uint8Array,AbortSignal,
    process:{env:{NEXT_PUBLIC_GOOGLE_CLIENT_ID:'fixture-client'}},fetch:async(...args)=>requests.push(args),
    require:id=>id==='react'?{useRef:value=>({current:value}),useState:value=>[value,()=>{}],useCallback:fn=>fn}:id==='next/navigation'?{useRouter:()=>({replace:path=>routes.push(path)})}:id==='next/script'?()=>null:id.endsWith('site-urls.mjs')?{learningPath:path=>path}:id.endsWith('/supabase/browser')?{createClient:()=>({auth:{getSession:async()=>({data:{session:existing?{}:null}}),signInWithIdToken:async()=>({data:{user:{user_metadata:{growvelt_learning_intent:'teach'}}},error:null})}})}:id.endsWith('.css')?{}:require(id)
  });
  const tree=module.exports.LearningGoogleOneTap();
  const script=tree.props.children[0];
  script.props.onReady();
  await Promise.resolve();
  for(let i=0;i<20&&(existing?!removed.length:!callbacks.length);i++)await new Promise(resolve=>setTimeout(resolve,10));
  if(existing){assert.equal(callbacks.length,0);assert.equal(routes.length,0);}
  else {assert.equal(callbacks.length,1);callbacks[0].callback({credential:'fixture'});for(let i=0;i<20&&!routes.length;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.deepEqual(routes,['/dashboard']);assert.equal(requests.length,1);}
  assert.deepEqual(removed,['growvelt-learning:google-one-tap-role-choice']);
}
console.log('PASS One Tap: no role picker or metadata changes; existing session retained, authenticated new session enters dashboard with login activity. No network.');
