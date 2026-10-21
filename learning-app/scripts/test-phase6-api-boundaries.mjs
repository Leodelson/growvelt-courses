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
const operations = [];
const providerCalls = [];

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: actor }, error: null }) },
    async rpc(name, args) {
      operations.push({ rpc: name, args });
      if (name === "is_growvelt_learning_admin") return { data: actor?.role === "admin", error: null };
      if (name === "is_approved_growvelt_instructor") return { data: actor?.role === "instructor", error: null };
      if (name === "assign_learning_company_course" && actor?.role !== "companyAdmin") return { data: null, error: { code: "42501" } };
      return { data: [], error: null };
    },
    from(table) {
      const operation = { table, filters: [] };
      operations.push(operation);
      const result = { data: [], error: null, count: 0 };
      const query = {
        select() { return query; },
        update(value) { operation.update = value; return query; },
        upsert(value) { operation.upsert = value; return query; },
        insert(value) { operation.insert = value; return query; },
        eq(key, value) { operation.filters.push([key, value]); return query; },
        is() { return query; }, or() { return query; }, order() { return query; }, limit() { return query; },
        maybeSingle: async () => ({ data: null, error: null }),
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
    module: moduleValue, exports: moduleValue.exports, URL, Request, Response, Headers, FormData, AbortSignal, console,
    process: { env: { TURNSTILE_SECRET_KEY: "local-test-value" } },
    fetch: async (...args) => { providerCalls.push(args); throw new Error("Provider access forbidden in this suite"); },
    require: id => id in mocks ? mocks[id] : id in shared ? shared[id] : require(id),
  }, { filename: fileURLToPath(new URL(path, root)) });
  return moduleValue.exports;
}

const shared = {};
shared["@/app/lib/security/request-origin"] = load("app/lib/security/request-origin.ts");
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
];
const handlers = new Map(routes.map(([path]) => [path, load(path)]));
const context = { params: Promise.resolve({ id: noticeId, workspaceId: "1" }) };
const request = (method, headers = { Origin: hosts[0] }, body = {}) => new Request(hosts[0] + "/api/local-fixture", { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

actor = { id: userId, email: "test@example.invalid", role: "admin" };
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
for (const user of [null, { id: userId, role: "learner" }, { id: userId, role: "instructor" }]) {
  actor = user;
  const before = adminCalls;
  assert.equal((await email.GET()).status, 403);
  assert.equal((await email.POST(request("POST", undefined, { action: "create" }))).status, 403);
  assert.equal(adminCalls, before, "Email Center denies other roles before using the service role");
}

actor = { id: userId, email: "test@example.invalid", role: "learner" };
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
assert.equal(operations[before].upsert.user_id, userId, "email preferences cannot target another user");

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
assert.equal((await newsletter.POST(request("POST", undefined, { email: "test@example.invalid" }))).status, 201);

actor = null;
for (const [path, method] of [["app/api/learning/notifications/route.ts", "PATCH"], ["app/api/learning/support/route.ts", "POST"], ["app/api/learning/email/preferences/route.ts", "POST"], ["app/api/auth/login-activity/route.ts", "POST"], ["app/api/instructor/payout-profile/route.ts", "POST"]]) {
  assert.equal((await handlers.get(path)[method](request(method), context)).status, 401, `${path}: signed-out requests are denied`);
}
assert.equal(providerCalls.length, 0, "no email, CAPTCHA, activity, or payment provider was called");
console.log("PASS 14 mutation handlers: cross-origin and sibling-site denial before backend access; Email Center role guards; notification/preference ownership; assignment validation and permissions; same-origin public forms; signed-out denial. All clients mocked.");
