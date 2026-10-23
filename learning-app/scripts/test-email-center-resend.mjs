import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const nativeRequire = createRequire(import.meta.url);

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/lib/email/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: mod.exports, URL, AbortSignal,
    require: id => id === "server-only" ? {} : id.endsWith("site-urls.mjs")
      ? { learningAbsoluteUrl: path => `https://www.growvelt.com${path}` } : id.startsWith("./") ? load(id.slice(2)) : nativeRequire(id),
  });
  cache.set(name, mod.exports);
  return mod.exports;
}
const { createEmailCenterResendTransport, EmailCenterProviderError } = load("email-center-resend");
const { emptyEmailDocument } = load("email-center");
const id = "11111111-1111-4111-8111-111111111111";
const segmentId = load("email-center-audience").LEARNING_EMAIL_SEGMENT_ID;
const transactional = { ...emptyEmailDocument, mode: "transactional", audience: "specific", recipients: ["learner@example.invalid"], subject: "Your Learning support request", message: "We have reviewed **your request**." };
const marketing = { ...emptyEmailDocument, subject: "Learning updates", message: "Here is your Learning update." };
const calls = [];
const config = {
  transactionalKey: "re_fixture_transactional", marketingKey: "re_fixture_marketing",
  senders: { learning: "learning@growvelt.com", partnerships: "partnership@growvelt.com" },
  verifiedDomains: ["growvelt.com"],
  pace: async () => undefined,
  request: async (url, init) => { calls.push({ url, init }); return Response.json({ id }); },
};
const item = { document: transactional, email: "learner@example.invalid", firstName: "Alex", operationKey: "learning-center-fixture-one" };
await assert.rejects(createEmailCenterResendTransport(config).sendTransactional(item), /not activated/);
assert.equal(calls.length, 0);
const transport = createEmailCenterResendTransport({ ...config, allowProviderWrites: true });
await transport.sendTransactional(item);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://api.resend.com/emails");
assert.equal(calls[0].init.redirect, "error");
assert.equal(calls[0].init.headers["Idempotency-Key"], item.operationKey);
assert.equal(calls[0].init.headers.Authorization, "Bearer re_fixture_transactional");
assert.deepEqual(JSON.parse(calls[0].init.body).to, [item.email]);
assert.match(JSON.parse(calls[0].init.body).html, /<strong>your request<\/strong>/);
await assert.rejects(transport.sendTransactional({ ...item, document: marketing }), /broadcasts/);
await assert.rejects(transport.sendTransactional({ ...item, email: "learner@example.invalid\r\nBcc: other@example.invalid" }), /recipient/);
await assert.rejects(transport.sendTransactional({ ...item, operationKey: "foreign-key" }), /operation key/);
await assert.rejects(createEmailCenterResendTransport({ ...config, verifiedDomains: [], allowProviderWrites: true }).sendTransactional(item), /Verify/);
await assert.rejects(createEmailCenterResendTransport({ ...config, senders: { learning: "careers@unrelated.invalid" }, allowProviderWrites: true }).sendTransactional(item), /Verify/);
await assert.rejects(createEmailCenterResendTransport({ ...config, senders: { partnerships: "partnerships@growvelt.com" }, allowProviderWrites: true }).sendTransactional({ ...item, document: { ...transactional, sender: "partnerships" } }), /approved partnership/);
assert.equal(calls.length, 1, "invalid requests never reach the provider");
await assert.rejects(transport.createBroadcastDraft({ document: marketing, segmentId: id, operationKey: "learning-center-fixture-broadcast" }), /approved Growvelt/);
await transport.createBroadcastDraft({ document: marketing, segmentId, operationKey: "learning-center-fixture-broadcast" });
const broadcast = JSON.parse(calls.at(-1).init.body);
assert.equal(calls.at(-1).url, "https://api.resend.com/broadcasts");
assert.equal(calls.at(-1).init.headers.Authorization, "Bearer re_fixture_marketing");
assert.equal(broadcast.send, false);
assert.equal(broadcast.segment_id, segmentId);
assert.match(broadcast.html, /RESEND_UNSUBSCRIBE_URL/);
assert.equal(typeof transport.sendBroadcast, "function", "dispatch is a separate worker-owned operation, never send:true at creation");
let attempts = 0;
for (const [status, retryAfter, expected] of [[429, "20", 20], [429, "invalid", null], [503, null, null]]) {
  const limited = createEmailCenterResendTransport({ ...config, allowProviderWrites: true, request: async () => {
    attempts++; return new Response("provider details must stay private", { status, headers: retryAfter ? { "Retry-After": retryAfter } : {} });
  } });
  await assert.rejects(limited.sendTransactional(item), error => error instanceof EmailCenterProviderError && error.status === status && error.retryAfterSeconds === expected && !error.message.includes("private"));
}
assert.equal(attempts, 3, "no automatic retries consume shared quota");
await assert.rejects(createEmailCenterResendTransport({ ...config, allowProviderWrites: true, request: async () => { throw new Error("secret diagnostic"); } }).sendTransactional(item), error => error instanceof EmailCenterProviderError && !error.message.includes("secret"));
await assert.rejects(createEmailCenterResendTransport({ ...config, allowProviderWrites: true, request: async () => Response.json({ id: "unconfirmed" }) }).sendTransactional(item), EmailCenterProviderError);
const secondId="22222222-2222-4222-8222-222222222222",pages=[];
const paginated=createEmailCenterResendTransport({...config,allowProviderWrites:true,request:async url=>{
  const parsed=new URL(url);pages.push(parsed);
  return Response.json({has_more:!parsed.searchParams.has("after"),data:[{id:parsed.searchParams.has("after")?secondId:id,email:parsed.searchParams.has("after")?"second@example.invalid":"first@example.invalid",unsubscribed:false}]});
}});
assert.equal((await paginated.readAudience(true)).contacts.length,2);
assert.equal(pages[0].searchParams.get("segment_id"),segmentId);
assert.equal(pages[1].searchParams.get("after"),id);
const repeated=createEmailCenterResendTransport({...config,allowProviderWrites:true,request:async()=>Response.json({has_more:true,data:[{id,email:"first@example.invalid",unsubscribed:false}]})});
await assert.rejects(repeated.readAudience(),/pagination changed/);
await assert.rejects(transport.getBroadcast("not-a-uuid"),/Invalid broadcast/);
console.log("PASS local-only Resend adapter fixtures: closed gate, verified senders, transactional idempotency, separate broadcast draft/dispatch, reserved segment, complete cursor pagination, repeated-page denial, private errors and no automatic retries. No network calls.");
