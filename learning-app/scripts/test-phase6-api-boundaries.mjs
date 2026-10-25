import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// Execute real route handlers with fake authenticated clients. Every provider
// and database operation is captured here; no hosted credentials or writes.
const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const userId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const noticeId = "00000000-0000-4000-8000-000000000003";
let actor = null;
let clientCalls = 0;
let adminCalls = 0;
let intakeError = null;
let supportError = null;
let workspaceError = null;
let scheduledAlerts = 0;
let alertDrains = 0;
let pendingCourse = null;
const operations = [];
const providerCalls = [];

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: actor }, error: null }) },
    async rpc(name, args) {
      operations.push({ rpc: name, args });
      if (managementCases.some(item => item.rpc === name)) return { data: [], error: workspaceError };
      if (name === "submit_public_learning_inquiry") return { data: [], error: intakeError };
      if (["submit_own_instructor_application", "create_own_learning_provider_organization", "create_own_learning_company_workspace"].includes(name)) return { data: [], error: workspaceError };
      if (name === "is_growvelt_learning_admin") return { data: actor?.role === "admin", error: null };
      if (name === "is_approved_growvelt_instructor") return { data: actor?.role === "instructor", error: null };
      if (["create_learning_support_case", "post_learning_support_message", "resolve_learning_support_case"].includes(name)) return { data: noticeId, error: supportError };
      if (name === "assign_learning_company_course" && actor?.role !== "companyAdmin") return { data: null, error: { code: "42501" } };
      return { data: [], error: null };
    },
    from(table) {
      const operation = { table, filters: [] };
      operations.push(operation);
      const result = { data: [], error: table === "newsletter_subscribers" ? intakeError : null, count: 0 };
      const query = {
        select() { return query; },
        update(value) { operation.update = value; return query; },
        upsert(value) { operation.upsert = value; return query; },
        insert(value) { operation.insert = value; return query; },
        eq(key, value) { operation.filters.push([key, value]); return query; },
        is() { return query; }, or() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle: async () => ({ data: table === "learning_courses" ? pendingCourse : null, error: null }),
        single: async () => ({ data: { id: noticeId }, error: null }),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, root), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleValue, exports: moduleValue.exports, URL, Request, Response, Headers, FormData, AbortSignal, TextDecoder, Buffer, console,
    process: { env: { TURNSTILE_SECRET_KEY: "local-test-value", CRON_SECRET: "local-cron-secret" } },
    fetch: async (...args) => { providerCalls.push(args); throw new Error("Provider access forbidden in this suite"); },
    require: id => id in mocks ? mocks[id] : id in shared ? shared[id] : require(id),
  }, { filename: fileURLToPath(new URL(path, root)) });
  return moduleValue.exports;
}

const shared = {};
shared["@/app/lib/email/instructor-notifications"] = { sendOrganizationInvitationEmail: async () => { throw new Error("Unexpected invitation email"); } };
shared["@/app/lib/email/company-notifications"] = { sendCompanyInvitationEmail: async () => { throw new Error("Unexpected invitation email"); } };
shared["@/app/lib/security/request-origin"] = load("app/lib/security/request-origin.ts");
shared["@/app/lib/security/json-body"] = load("app/lib/security/json-body.ts");
shared["@/app/lib/email/admin-submission-runtime"] = {scheduleAdminSubmissionAlerts(){scheduledAlerts++;},async drainAdminSubmissionAlerts(){alertDrains++;return{state:"checked",accepted:0};}};
shared["@/app/lib/email/email-center"] = load("app/lib/email/email-center.ts");
shared["@/app/lib/email/email-center-authorization"] = load("app/lib/email/email-center-authorization.ts", {"server-only":{}});
shared["@/app/lib/email/email-center-render"] = { renderEmailCenterMessage: () => "fixture email preview" };
shared["@/app/lib/email/email-center-runtime"] = { emailCenterRelease: () => ({enabled:false}) };
shared["@/app/lib/email/email-center-broadcast-worker"] = {};
shared["@/app/lib/email/email-center-account-worker"] = {};
shared["@/app/lib/email/email-center-consent-worker"] = {};
shared["@/app/lib/supabase/server"] = { createClient: async () => { clientCalls++; return client(); } };
shared["@/app/lib/supabase/admin"] = { createAdminClient: () => { adminCalls++; return client(); } };
shared["@/app/lib/email/growvelt-email-template"] = { renderGrowveltEmail: () => "mock-email" };
shared["@/app/lib/site-urls.mjs"] = { learningAbsoluteUrl: path => new URL(path, "https://www.growvelt.com").href };
shared["@/app/lib/learning/notification-retention"] = { LOGIN_NOTIFICATION_KIND: "login", LOGIN_NOTIFICATION_RETENTION_MS: 86400000 };
shared["@/app/lib/auth/login-activity"] = { recordLearningSignIn: async () => providerCalls.push("login-activity") };
shared["@/app/lib/payments/paystack"] = {
  getPaystackConfig: () => ({ mode: "test", callbackUrl: "https://www.growvelt.com/payments/paystack/callback", checkoutEnabled: true }),
  getPaystackTestConfig: () => ({}),
  initializePaystackLiveTransaction: async () => { throw new Error("No payments allowed"); },
  initializePaystackTestTransaction: async () => { throw new Error("No payments allowed"); },
  createPaystackTestTransferRecipient: async () => { throw new Error("No transfers allowed"); },
  resolvePaystackTestAccount: async () => { throw new Error("No bank requests allowed"); },
};
shared["@/app/lib/payments/paystack-config"] = { paystackCallbackForRequest: (_url, callback) => callback };

const { isSameOriginRequest } = shared["@/app/lib/security/request-origin"];
const hosts = ["https://www.growvelt.com", "https://learn.growvelt.com", "https://www.learn.growvelt.com"];
for (const host of hosts) {
  assert.equal(isSameOriginRequest(new Request(host + "/api/example", { headers: { Origin: host } })), true);
  assert.equal(isSameOriginRequest(new Request(host + "/api/example", { headers: { "Sec-Fetch-Site": "same-origin" } })), true);
  assert.equal(isSameOriginRequest(new Request(host + "/api/example")), true, "non-browser calls still require route-level authentication");
  for (const origin of [...hosts.filter(value => value !== host), "https://jobs.growvelt.com", "https://evil.invalid", "null", host + ".evil.invalid"]) {
    assert.equal(isSameOriginRequest(new Request(host + "/api/example", { headers: { Origin: origin } })), false);
  }
  for (const site of ["same-site", "cross-site", "none"]) {
    assert.equal(isSameOriginRequest(new Request(host + "/api/example", { headers: { "Sec-Fetch-Site": site } })), false);
  }
}

const managementCases = [
  {path:"app/api/instructor/organizations/[organizationId]/profile/route.ts",limit:32768,rpc:"update_own_learning_provider_organization_profile",status:201,payload:{headline:"A course provider",description:"A".repeat(80),contactEmail:"test@example.invalid"}},
  {path:"app/api/instructor/organizations/[organizationId]/members/[memberId]/revoke/route.ts",limit:4096,rpc:"revoke_own_learning_provider_organization_member",status:200,payload:{reason:"Membership ended"}},
  {path:"app/api/instructor/organizations/[organizationId]/invitations/route.ts",limit:4096,rpc:"create_learning_provider_organization_invitation",status:201,payload:{email:"test@example.invalid",role:"instructor"}},
  {path:"app/api/company/workspaces/[workspaceId]/invitations/route.ts",limit:4096,rpc:"create_learning_company_invitation",status:201,payload:{email:"test@example.invalid",role:"member"}},
];
const routes = [
  ["app/api/learning/admin/emails/route.ts", ["POST"]],
  ["app/api/learning/support/route.ts", ["POST"]],
  ["app/api/learning/support/[id]/route.ts", ["POST", "PATCH"]],
  ["app/api/learning/notifications/route.ts", ["PATCH"]],
  ["app/api/learning/email/preferences/route.ts", ["POST"]],
  ["app/api/auth/login-activity/route.ts", ["POST"]],
  ["app/api/company/workspaces/[workspaceId]/assignments/route.ts", ["POST"]],
  ["app/api/inquiries/route.ts", ["POST"]],
  ["app/api/newsletter/subscribe/route.ts", ["POST"]],
  ["app/api/auth/verify-turnstile/route.ts", ["POST"]],
  ["app/api/instructor/payout-profile/route.ts", ["POST", "DELETE"]],
  ["app/api/payments/paystack/initialize/route.ts", ["POST"]],
  ["app/api/instructor/courses/[courseId]/notify-submission/route.ts", ["POST"]],
  ["app/api/instructor/application/route.ts", ["POST"]],
  ["app/api/instructor/organizations/route.ts", ["POST"]],
  ["app/api/company/workspaces/route.ts", ["POST"]],
  ...managementCases.map(({path}) => [path,["POST"]]),
];
const handlers = new Map(routes.map(([path]) => [path, load(path)]));
const context = { params: Promise.resolve({ id: noticeId, workspaceId: "1", organizationId: "1", memberId: otherId }) };
const request = (method, headers = { Origin: hosts[0] }, body = {}) => new Request(hosts[0] + "/api/local-fixture", { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

for (const path of ["app/api/inquiries/route.ts", "app/api/newsletter/subscribe/route.ts", "app/api/auth/verify-turnstile/route.ts"]) {
  for (const [type, body, status] of [["text/plain", "{}", 415], ["application/json", "{broken", 400], ["application/json", JSON.stringify({ padding: "x".repeat(33000) }), 413]]) {
    const before = [clientCalls, adminCalls, operations.length, providerCalls.length];
    const invalid = new Request(hosts[0] + "/api/local-fixture", { method: "POST", headers: { Origin: hosts[0], "Content-Type": type }, body });
    assert.equal((await handlers.get(path).POST(invalid)).status, status, `${path}: invalid/oversized JSON`);
    assert.deepEqual([clientCalls, adminCalls, operations.length, providerCalls.length], before, "invalid body rejected before backend/provider access");
  }
}

actor = { id: userId, email: "admin@growvelt.com", email_confirmed_at:"2026-10-22", role: "admin" };
const boundedRoutes = [
  ...managementCases.map(({path,limit}) => [path,"POST",limit]),
  ["app/api/learning/admin/emails/route.ts", "POST", 32768],
  ["app/api/learning/support/route.ts", "POST", 32768],
  ["app/api/learning/support/[id]/route.ts", "POST", 32768],
  ["app/api/learning/notifications/route.ts", "PATCH", 1024],
  ["app/api/learning/email/preferences/route.ts", "POST", 1024],
  ["app/api/instructor/application/route.ts", "POST", 65536],
  ["app/api/instructor/organizations/route.ts", "POST", 4096],
  ["app/api/company/workspaces/route.ts", "POST", 4096],
];
for (const [path, method, limit] of boundedRoutes) {
  for (const [type, body, status] of [
    ["text/plain", "{}", 415], ["application/json", "{broken", 400],
    ...["null", "[]", '"text"', "true", "12"].map(value => ["application/json", value, 400]),
    ["application/json", JSON.stringify({padding: "x".repeat(limit)}), 413],
  ]) {
    const beforeAdmin = adminCalls, beforeOps = operations.length, beforeProvider = providerCalls.length;
    const invalid = new Request(hosts[0] + "/api/local-fixture", { method, headers: { Origin: hosts[0], "Content-Type": type, "Content-Length": "1" }, body });
    const rejected = await handlers.get(path)[method](invalid, context);
    assert.equal(rejected.status, status, `${path}: invalid or oversized body`);
    assert.match(rejected.headers.get("cache-control"), /no-store/);
    assert.equal(adminCalls, beforeAdmin, "invalid body never creates the privileged client");
    assert.equal(providerCalls.length, beforeProvider);
    assert.ok(operations.slice(beforeOps).every(op => op.rpc === "is_growvelt_learning_admin"), "authentication/role checks may run, but no mutation or content query");
  }
}
for (const [path, methods] of routes) {
  for (const method of methods) {
    for (const headers of [{ Origin: "https://jobs.growvelt.com" }, { Origin: "https://evil.invalid" }, { "Sec-Fetch-Site": "same-site" }]) {
      const before = [clientCalls, adminCalls, operations.length, providerCalls.length];
      assert.equal((await handlers.get(path)[method](request(method, headers), context)).status, 403, `${path} ${method}`);
      assert.deepEqual([clientCalls, adminCalls, operations.length, providerCalls.length], before, `${path}: reject before backend/provider work`);
    }
  }
}

const email = handlers.get(routes[0][0]);
for (const user of [null, { id: userId, role: "learner" }, { id: userId, role: "instructor" }, {id:userId,role:"admin",email:"other@growvelt.com",email_confirmed_at:"2026-10-22"}, {id:userId,role:"admin",email:"admin@growvelt.com"}, {id:userId,role:"learner",email:"admin@growvelt.com",email_confirmed_at:"2026-10-22"}]) {
  actor = user;
  const before = adminCalls;
  assert.equal((await email.GET()).status, 403);
  const forbidden = request("POST", undefined, { action: "create" });
  Object.defineProperty(forbidden, "body", { get() { throw new Error("must not parse a forbidden request"); } });
  assert.equal((await email.POST(forbidden)).status, 403);
  assert.equal(adminCalls, before, "Email Center denies other roles before using the service role");
}

actor = { id: userId, email: "test@example.invalid", email_confirmed_at:"2026-10-22", role: "learner" };
const notices = handlers.get("app/api/learning/notifications/route.ts");
let before = operations.length;
assert.equal((await notices.PATCH(request("PATCH", undefined, { id: noticeId, userId: otherId }))).status, 204);
const change = operations[before];
assert.equal(change.table, "learning_notifications");
assert.deepEqual(change.filters, [["id", noticeId], ["user_id", userId]], "notification updates scope to the authenticated owner");
before = operations.length;
assert.equal((await notices.PATCH(request("PATCH", undefined, { id: "not-a-uuid" }))).status, 400);
assert.equal(operations.length, before);
const preferences = handlers.get("app/api/learning/email/preferences/route.ts");
before = operations.length;
assert.equal((await preferences.POST(request("POST", undefined, { marketingOptIn: false, userId: otherId }))).status, 200);
assert.equal(operations[before].rpc, "set_learning_email_preference");
assert.equal(operations[before].args.p_user_id, userId, "email preferences cannot target another user");
assert.equal(operations[before].args.p_source, "settings");

// Exact 1 KiB JSON is supported; one additional byte is rejected, even when
// the payload includes a valid notification ID or preference value.
for (const [route, method, payload] of [[notices, "PATCH", {id: noticeId}], [preferences, "POST", {marketingOptIn: false}]]) {
  const base = JSON.stringify({...payload, padding: ""});
  const exact = JSON.stringify({...payload, padding: "x".repeat(1024 - base.length)});
  assert.equal((await route[method](new Request(hosts[0] + "/api/local-fixture", {method, headers:{Origin:hosts[0], "Content-Type":"application/json"}, body:exact}))).status, method === "PATCH" ? 204 : 200);
  assert.equal((await route[method](new Request(hosts[0] + "/api/local-fixture", {method, headers:{Origin:hosts[0], "Content-Type":"application/json"}, body:exact + " "}))).status, 413);
}
const support = handlers.get("app/api/learning/support/route.ts");
const thread = handlers.get("app/api/learning/support/[id]/route.ts");
// Maximum fields with JSON escaping remain within the byte envelope.
const maxMessage = '"'.repeat(5000);
assert.equal((await support.POST(request("POST", undefined, {topic:"courses",subject:'"'.repeat(160),message:maxMessage,userId:otherId}))).status, 201);
const escapedSupport = '{"topic":"courses","subject":"' + '\\u0061'.repeat(160) + '","message":"' + '\\u0061'.repeat(5000) + '"}';
assert.equal((await support.POST(new Request(hosts[0] + "/api/local-fixture", {method:"POST",headers:{Origin:hosts[0],"Content-Type":"application/json"},body:escapedSupport}))).status,201,"full Unicode-escaped maximum-length support fields remain compatible");
before = operations.length;
assert.equal((await thread.POST(request("POST", undefined, {message:maxMessage,userId:otherId,sender_role:"support"}), context)).status, 204);
assert.deepEqual(Object.keys(operations[before].args).sort(), ["p_conversation_id", "p_message"], "caller cannot supply the sender or target user");
assert.equal(operations[before].args.p_conversation_id, noticeId);
for (const [code, status] of [["42501",403],["22023",429],["XX000",503]]) {
  supportError = {code};
  assert.equal((await thread.POST(request("POST", undefined, {message:"Please check my course."}),context)).status,status);
  assert.equal((await thread.PATCH(request("PATCH"),context)).status,code === "42501" ? 403 : 503);
}
supportError = null;
const beforeInvalidThread = operations.length;
assert.equal((await thread.POST(request("POST",undefined,{message:"test"}),{params:Promise.resolve({id:"invalid"})})).status,404);
assert.equal(operations.length,beforeInvalidThread);
actor = {id:userId,email:"admin@growvelt.com",email_confirmed_at:"2026-10-22",role:"admin"};
assert.equal((await email.POST(request("POST",undefined,{action:"save",id:noticeId,revision:0,document:{sender:"learning",mode:"marketing",audience:"learners",recipients:[],subject:'"'.repeat(160),headline:'"'.repeat(160),message:'"'.repeat(4000),personalized:false,buttonText:"",buttonUrl:"",bell:false}}))).status,201);
for (const address of ["admin@growvelt.com","nduleonardc@gmail.com"]) {
  actor={id:userId,email:address,email_confirmed_at:"2026-10-22",role:"admin"};
  assert.equal((await email.GET()).status,200,"both permitted confirmed admins can load Email Center");
  const beforePreview=adminCalls;
  const document={sender:"partnerships",mode:"marketing",audience:"all",recipients:[],subject:"Learning news",headline:"",message:"A message for our Learning community.",personalized:false,buttonText:"",buttonUrl:"",bell:false};
  assert.equal((await email.POST(request("POST",undefined,{action:"preview",document}))).status,200);
  assert.equal(adminCalls,beforePreview,"preview does not use privileged recipient access");
  assert.equal((await email.POST(request("POST",undefined,{action:"send",confirmation:"SEND LEARNING EMAILS"}))).status,503,"real and legacy sending stay closed");
  assert.equal(adminCalls,beforePreview,"send gate stops before creating a privileged client");
  assert.equal((await email.POST(request("POST",undefined,{action:"save",id:"invalid",revision:0,document}))).status,400);
  assert.equal((await email.POST(request("POST",undefined,{action:"review",id:noticeId,revision:1}))).status,200);
}

const assignments = handlers.get("app/api/company/workspaces/[workspaceId]/assignments/route.ts");
for (const body of [{ courseId: 0, assignedUserId: userId }, { courseId: 1, assignedUserId: "invalid" }]) {
  before = operations.length;
  assert.equal((await assignments.POST(request("POST", undefined, body), context)).status, 400);
  assert.equal(operations.length, before);
}
assert.equal((await assignments.POST(request("POST", undefined, { courseId: 1, assignedUserId: otherId }), context)).status, 403, "database permission denial remains a forbidden response");
actor = { id: userId, role: "companyAdmin" };
assert.equal((await assignments.POST(request("POST", undefined, { courseId: 1, assignedUserId: otherId }), context)).status, 201);

const contact = handlers.get("app/api/inquiries/route.ts");
assert.equal((await contact.POST(request("POST", undefined, { kind: "contact", name: "Example", email: "test@example.invalid", subject: "Course help", message: "Please help me access my course materials." }))).status, 201);
const newsletter = handlers.get("app/api/newsletter/subscribe/route.ts");
const newsletterBody = { email: "test@example.invalid" };
const accepted = await newsletter.POST(request("POST", undefined, newsletterBody));
assert.equal(accepted.status, 202);
const acceptedMessage = await accepted.json();
intakeError = { code: "23505" };
const duplicate = await newsletter.POST(request("POST", undefined, newsletterBody));
assert.equal(duplicate.status, accepted.status, "newsletter duplicate does not disclose membership through status");
assert.deepEqual(await duplicate.json(), acceptedMessage, "newsletter duplicate has the same generic response");
intakeError = { code: "PT429" };
for (const [route, body] of [[newsletter, newsletterBody], [contact, { kind: "contact", name: "Example", email: "test@example.invalid", subject: "Course help", message: "Please help me access my course materials." }]]) {
  const limited = await route.POST(request("POST", undefined, body));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "3600");
  assert.equal(limited.headers.get("cache-control"), "no-store");
}
intakeError = null;

actor = null;
for (const [path, method] of [["app/api/learning/notifications/route.ts", "PATCH"], ["app/api/learning/support/route.ts", "POST"], ["app/api/learning/email/preferences/route.ts", "POST"], ["app/api/auth/login-activity/route.ts", "POST"], ["app/api/instructor/payout-profile/route.ts", "POST"]]) {
  const signedOut = request(method);
  Object.defineProperty(signedOut, "body", { get() { throw new Error("must not parse before authentication"); } });
  assert.equal((await handlers.get(path)[method](signedOut, context)).status, 401, `${path}: signed-out requests are denied before parsing`);
}
// Session ownership remains authoritative, even when callers submit another
// user's ID or request an approved/admin role in otherwise valid form JSON.
const applicationBody = { country: "NG", phone: "123456789", headline: "Course instructor", expertise: ["Software"], yearsExperience: 5, teachingExperience: "Teaching experience", bio: "Instructor biography", motivation: "Help learners build skills", portfolioUrl: "https://example.invalid/portfolio", userId: otherId, approval_status: "approved", role: "admin" };
const creationCases = [
  ["app/api/instructor/application/route.ts", applicationBody, "submit_own_instructor_application", 401],
  ["app/api/instructor/organizations/route.ts", {name:"Example Academy",slug:"example-academy",ownerId:otherId,role:"admin"}, "create_own_learning_provider_organization", 403],
  ["app/api/company/workspaces/route.ts", {name:"Example Team",slug:"example-team",ownerId:otherId,role:"admin"}, "create_own_learning_company_workspace", 401],
];
for (const [path, payload, rpc, deniedStatus] of creationCases) {
  const handler = handlers.get(path);
  actor = null;
  const unauthenticated = request("POST");
  Object.defineProperty(unauthenticated, "body", {get(){throw new Error("must not parse before authentication");}});
  before = operations.length;
  assert.equal((await handler.POST(unauthenticated)).status,401);
  assert.equal(operations.length,before);
  actor = {id:userId,role:"learner"};
  workspaceError = {code:"42501"};
  const alertsBefore = scheduledAlerts;
  assert.equal((await handler.POST(request("POST",undefined,payload))).status,deniedStatus);
  assert.equal(scheduledAlerts,alertsBefore,"denied submissions cannot schedule alerts");
  workspaceError = null;
  before = operations.length;
  assert.equal((await handler.POST(request("POST",undefined,payload))).status,201);
  assert.equal(operations.length,before+1);
  assert.equal(operations[before].rpc,rpc);
  assert.ok(!JSON.stringify(operations[before].args).includes(otherId));
  assert.ok(!("role" in operations[before].args) && !("approval_status" in operations[before].args));
}
// Maximum form-length Unicode is accepted even when JSON escapes every character.
const maximumApplication = {...applicationBody,country:"界".repeat(100),phone:"1".repeat(32),headline:"界".repeat(160),teachingExperience:"界".repeat(1500),bio:"界".repeat(2000),motivation:"界".repeat(1500),expertise:Array.from({length:12},(_,i)=>`Topic ${i}`)};
const escaped = JSON.stringify(maximumApplication).replace(/界/g,"\\u754c");
assert.equal((await handlers.get(creationCases[0][0]).POST(new Request(hosts[0]+"/api/local-fixture",{method:"POST",headers:{Origin:hosts[0],"Content-Type":"application/json"},body:escaped}))).status,201);
for (const [path] of creationCases.slice(1)) {
  const escapedName=JSON.stringify({name:"界".repeat(160),slug:"a".repeat(100)}).replace(/界/g,"\\u754c");
  assert.equal((await handlers.get(path).POST(new Request(hosts[0]+"/api/local-fixture",{method:"POST",headers:{Origin:hosts[0],"Content-Type":"application/json"},body:escapedName}))).status,201);
}
actor = null;
const ownApplication = handlers.get("app/api/instructor/application/route.ts");
const adminBeforeApplication = adminCalls;
assert.equal((await ownApplication.GET()).status,401);
assert.equal(adminCalls,adminBeforeApplication);
actor = {id:userId,role:"learner"};
before = operations.length;
assert.equal((await ownApplication.GET()).status,200);
assert.deepEqual(operations[before].filters,[["user_id",userId]],"privileged application lookup is bound to verified session");
actor = null;
const courseAlerts = handlers.get("app/api/instructor/courses/[courseId]/notify-submission/route.ts");
for (const item of managementCases) {
  const handler = handlers.get(item.path);
  actor = null;
  const denied = request("POST");
  Object.defineProperty(denied,"body",{get(){throw new Error("must authenticate before reading management body");}});
  before = operations.length;
  assert.equal((await handler.POST(denied,context)).status,401);
  assert.equal(operations.length,before);
  actor = {id:userId,role:"learner"};
  workspaceError = {code:"42501"};
  const beforePrivileged = adminCalls;
  assert.equal((await handler.POST(request("POST",undefined,item.payload),context)).status,403);
  assert.equal(adminCalls,beforePrivileged,"permission denial must not load email context with privileged access");
  workspaceError = null;
  before = operations.length;
  assert.equal((await handler.POST(request("POST",undefined,{...item.payload,userId:noticeId,ownerId:noticeId}),context)).status,item.status);
  assert.equal(operations[before].rpc,item.rpc);
  assert.ok(!JSON.stringify(operations[before].args).includes(noticeId),"caller cannot override session owner");
  before = operations.length;
  assert.equal((await handler.POST(request("POST",undefined,item.payload),{params:Promise.resolve({organizationId:"0",workspaceId:"0",memberId:otherId})})).status,400);
  assert.equal(operations.length,before);
}
for (const [index,payload] of [[0,{headline:"界".repeat(160),description:"界".repeat(2400),contactEmail:"test@example.invalid",websiteUrl:"x".repeat(400),linkedinUrl:"x".repeat(400),instagramUrl:"x".repeat(400)}],[1,{reason:"界".repeat(500)}]]) {
  const item=managementCases[index];
  const raw=JSON.stringify(payload).replace(/界/g,"\\u754c");
  assert.equal((await handlers.get(item.path).POST(new Request(hosts[0]+"/api/local-fixture",{method:"POST",headers:{Origin:hosts[0],"Content-Type":"application/json"},body:raw}),context)).status,item.status);
}
actor = null;
const courseContext = {params:Promise.resolve({courseId:"1"})};
const beforeAlerts = scheduledAlerts;
assert.equal((await courseAlerts.POST(request("POST"), courseContext)).status,401);
assert.equal((await courseAlerts.POST(request("POST"),{params:Promise.resolve({courseId:"NaN"})})).status,400);
actor={id:userId,role:"instructor"};
assert.equal((await courseAlerts.POST(request("POST"),courseContext)).status,404);
assert.equal(scheduledAlerts,beforeAlerts);
pendingCourse={id:1};before=operations.length;
assert.equal((await courseAlerts.POST(request("POST"),courseContext)).status,202);
assert.equal(scheduledAlerts,beforeAlerts+1);
assert.deepEqual(operations[before].filters,[["id",1],["instructor_id",userId],["status","pending_review"]]);
assert.ok(!operations[before].update&&!operations[before].insert,"notification scheduling cannot submit/approve a course");
const alertCron=load("app/api/internal/admin-submission-alerts/route.ts");
for(const authorization of [null,"Bearer wrong","Bearer local-cron-secret-extra"]){
  assert.equal((await alertCron.GET(new Request(hosts[0]+"/api/internal/admin-submission-alerts",{headers:authorization?{authorization}:{}}))).status,401);
}
assert.equal(alertDrains,0);
assert.equal((await alertCron.GET(new Request(hosts[0]+"/api/internal/admin-submission-alerts",{headers:{authorization:"Bearer local-cron-secret"}}))).status,200);
assert.equal(alertDrains,1);
assert.equal(providerCalls.length, 0, "no email, CAPTCHA, activity, or payment provider was called");
console.log("PASS mutation boundaries plus admin-alert scheduling: origin/auth/ownership gates, bounded JSON, role checks, cron-secret denial, exact scheduling and no course mutation. All providers mocked.");
