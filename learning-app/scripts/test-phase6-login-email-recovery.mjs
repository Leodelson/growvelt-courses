import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Execute the real scheduling/delivery module. No actual email or network call.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/lib/email/login-activity.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
const user = {id:"00000000-0000-4000-8000-000000000001",email:"private@example.invalid",user_metadata:{full_name:"Example Learner"}};
const signInAt = "2026-10-22T09:00:00.000Z";
const headers = new Headers({"x-real-ip":"192.0.2.1","x-vercel-ip-city":"Example City","x-vercel-ip-country":"NG"});
for (const scenario of ["accepted","rejected","timeout","schedule-error","missing-key","missing-email"]) {
  const jobs = [], calls = [], logs = [], timeouts = [];
  const moduleValue = {exports:{}};
  vm.runInNewContext(compiled, {
    exports:moduleValue.exports, Date, Intl, AbortSignal:{timeout:ms => {timeouts.push(ms);return new AbortController().signal;}},
    process:{env: scenario === "missing-key" ? {} : {RESEND_API_KEY:"fixture-secret-not-for-logs"}},
    console:{warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
    fetch:async (url, options) => {
      calls.push({url,options});
      if (scenario === "timeout") throw new Error("sensitive provider error private@example.invalid fixture-secret-not-for-logs");
      return {ok:scenario === "accepted",status:scenario === "accepted" ? 200 : 503};
    },
    require:name => name === "server-only" ? {} : name === "next/server" ? {after:job => {
      if (scenario === "schedule-error") throw new Error("sensitive scheduling failure");
      jobs.push(job);
    }} : name.endsWith("growvelt-email-template") ? {renderGrowveltEmail:()=>"private fixture email HTML"}
      : name.endsWith("site-urls.mjs") ? {getLearningOrigin:()=>"https://www.growvelt.com",learningAbsoluteUrl:path=>"https://www.growvelt.com"+path} : require(name),
  });
  assert.doesNotThrow(()=>moduleValue.exports.scheduleLearningLoginActivityEmail(scenario === "missing-email" ? {...user,email:undefined} : user, headers,signInAt,"Chrome","Desktop"));
  assert.equal(calls.length,0,"no provider work before the scheduled task");
  for (const job of jobs) await assert.doesNotReject(job);
  assert.equal(calls.length,["accepted","rejected","timeout"].includes(scenario)?1:0);
  if (calls.length) {
    const {url,options}=calls[0], payload=JSON.parse(options.body);
    assert.equal(url,"https://api.resend.com/emails");
    assert.deepEqual(payload.to,[user.email]);
    assert.equal(payload.subject, `New login to your Growvelt account: ${signInAt}`, "separate sign-in events have distinct inbox subjects to reduce Gmail thread trimming");
    assert.equal(options.headers["Idempotency-Key"],`growvelt-learning-login-${user.id}-${Date.parse(signInAt)}`);
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(timeouts,[12000],"the existing 12-second provider bound remains wired");
    assert.ok(payload.tags.some(tag=>tag.name === "product" && tag.value === "learning"));
  }
  assert.equal(logs.length,["accepted","missing-email"].includes(scenario)?0:1);
  assert.doesNotMatch(JSON.stringify(logs),/private@example|fixture-secret|192\.0\.2\.1|Example City|private fixture email|sensitive/);
}
console.log("PASS real login-email recovery: deferred delivery, recipient/idempotency scope, provider rejection/timeout and scheduling failure do not escape, missing configuration/email skips, and logs exclude fixture PII/secrets. Provider acceptance is not inbox delivery; no network used.");
