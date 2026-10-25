import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const learnerId = "00000000-0000-4000-8000-000000000001";
const caseId = "00000000-0000-4000-8000-000000000002";
let actor = { id: learnerId };
let snapshot = [{ course_title: "Trusted course", lesson_title: "Trusted lesson", is_current: true }];
let supportError = null;
let supportCalls = [];
let alerts = 0;
let clients = 0;

function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, root), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleValue, exports: moduleValue.exports, URL, Request, Response, Headers, TextDecoder, Buffer, console,
    process: { env: {} },
    require: id => id in mocks ? mocks[id] : id in shared ? shared[id] : require(id),
  }, { filename: fileURLToPath(new URL(path, root)) });
  return moduleValue.exports;
}

class NextResponse extends Response {
  static json(body, init) { return Response.json(body, init); }
}
const operations = [];
const shared = {};
shared["next/server"] = { NextResponse };
shared["@/app/lib/security/request-origin"] = load("app/lib/security/request-origin.ts");
shared["@/app/lib/security/json-body"] = load("app/lib/security/json-body.ts");
shared["@/app/lib/email/admin-submission-runtime"] = { scheduleAdminSubmissionAlerts() { alerts += 1; } };
shared["@/app/lib/supabase/server"] = {
  async createClient() {
    clients += 1;
    return {
      auth: { getUser: async () => ({ data: { user: actor }, error: null }) },
      async rpc(name, args) {
        operations.push({ name, args });
        if (name === "get_own_enrolled_lesson_snapshot") return { data: snapshot, error: null };
        if (name === "create_learning_support_case") { supportCalls.push(args); return { data: caseId, error: supportError }; }
        throw new Error(`Unexpected RPC: ${name}`);
      },
    };
  },
};

const { POST } = load("app/api/learning/lesson-reports/route.ts");
const origin = "https://www.growvelt.com";
const body = { courseSlug: "web-development", lessonId: 119, reasons: ["quality", "clarity"], details: "The audio is hard to hear." };
const request = (payload = body, headers = {}) => new Request(`${origin}/api/learning/lesson-reports`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload),
});

let beforeClients = clients;
let response = await POST(request(body, { Origin: "https://jobs.growvelt.com" }));
assert.equal(response.status, 403, "reject cross-product origins before auth or database access");
assert.equal(clients, beforeClients);

actor = null;
const unauthenticated = new Request(`${origin}/api/lesson-reports`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "not-json" });
response = await POST(unauthenticated);
assert.equal(response.status, 401, "authenticate before parsing report body");

actor = { id: learnerId };
const callsBeforeValidation = operations.length;
response = await POST(request({ ...body, reasons: ["made-up"] }));
assert.equal(response.status, 400, "reject unrecognized report reason");
assert.equal(operations.length, callsBeforeValidation, "invalid reasons cannot query or mutate lesson data");
response = await POST(request({ ...body, reasons: ["other"], details: "short" }));
assert.equal(response.status, 400, "require details for an other report");
assert.equal(operations.length, callsBeforeValidation);

response = await POST(request({ ...body, courseTitle: "Untrusted course", lessonTitle: "Untrusted lesson" }));
assert.equal(response.status, 201);
assert.deepEqual(await response.json(), { id: caseId });
assert.equal(alerts, 1, "successful support-case insertion schedules the existing admin alert worker");
assert.equal(supportCalls.length, 1);
assert.equal(supportCalls[0].p_topic, "courses");
assert.ok(supportCalls[0].p_subject.startsWith("Lesson report: Trusted course - Trusted lesson"));
assert.match(supportCalls[0].p_message, /Poor video or audio quality/);
assert.match(supportCalls[0].p_message, /The lesson is unclear or hard to follow/);
assert.match(supportCalls[0].p_message, /Additional details: The audio is hard to hear\./);
assert.doesNotMatch(supportCalls[0].p_message, /Untrusted course|Untrusted lesson/);
assert.match(supportCalls[0].p_message, /instructor has not been notified/i);

snapshot = [];
response = await POST(request());
assert.equal(response.status, 403, "a learner cannot report a lesson outside their enrolled snapshot");
assert.equal(supportCalls.length, 1);
assert.equal(alerts, 1);

snapshot = [{ course_title: "Trusted course", lesson_title: "Trusted lesson", is_current: true }];
supportError = { code: "22023" };
response = await POST(request());
assert.equal(response.status, 429, "existing support throttling is preserved");
assert.equal(alerts, 1, "failed reports do not schedule admin alerts");
supportError = null;

const migration = readFileSync(new URL("supabase/migrations/20261112000000_add_own_learning_lesson_reactions.sql", root), "utf8");
assert.match(migration, /primary key \(lesson_id, learner_id\)/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on public\.learning_lesson_reactions from public, anon, authenticated/i);
assert.match(migration, /has_own_learning_course_access\(learner, course_key\)/i);
assert.match(migration, /instructor_id is distinct from learner/i);
assert.match(migration, /when public\.learning_lesson_reactions\.reaction = excluded\.reaction then null/i);

const playerCss = readFileSync(new URL("app/dashboard/my-learning/[slug]/lessons/[lessonId]/lesson-player.module.css", root), "utf8");
assert.match(playerCss, /\.courseOutline\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/s);
assert.match(playerCss, /@container \(max-width: 680px\)[\s\S]*?\.courseOutline\s*\{[^}]*max-height:/);
const globalCss = readFileSync(new URL("app/globals.css", root), "utf8");
assert.match(globalCss, /\.dashboard-main \{[^}]*padding: 36px 0 80px/);
const subscriptionsCss = readFileSync(new URL("app/components/learning/subscriptions.module.css", root), "utf8");
assert.match(subscriptionsCss, /\.page \{[^}]*padding-block: 0 40px !important/);

console.log("PASS lesson feedback: origin/auth, reason validation, enrollment check, trusted report context, support throttling, admin-alert scheduling, per-learner reaction protections and responsive internal scrolling.");
