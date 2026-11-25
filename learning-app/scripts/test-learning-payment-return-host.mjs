import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import * as urls from "../app/lib/site-urls.mjs";

const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" };
function load(path, mocks, env = future) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, URL, Request, Response, process: { env }, console,
    require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected dependency: ${name}`); } });
  return module.exports;
}
const config = load("../app/lib/payments/paystack-config.ts", { "../site-urls.mjs": urls });
const requestOrigin = load("../app/lib/security/request-origin.ts", { "../site-urls.mjs": urls });
const { paystackCallbackForRequest: callback } = config;
for (const host of ["learn.growvelt.com", "www.growvelt.com"]) {
  for (const configuredHost of ["learn.growvelt.com", "www.growvelt.com"]) {
    assert.equal(callback(`https://${host}/api/checkout`, `https://${configuredHost}/payments/paystack/callback?keep=1`), `https://${host}/payments/paystack/callback?keep=1`);
  }
}
for (const origin of ["https://jobs.growvelt.com", "https://www.grovelt.com", "https://evil.invalid", "http://www.growvelt.com", "https://www.growvelt.com:444", "https://www.growvelt.com.evil.invalid"]) {
  assert.throws(() => callback(`${origin}/api/checkout`, "https://learn.growvelt.com/payments/paystack/callback"));
}
for (const target of ["https://evil.invalid/payments/paystack/callback", "https://www.growvelt.com/auth/callback", "https://user@www.growvelt.com/payments/paystack/callback", "https://www.growvelt.com/payments/paystack/callback#token"]) {
  assert.throws(() => callback("https://www.growvelt.com/api/checkout", target));
}
assert.equal(callback("http://localhost:3000/api/checkout", "http://localhost:3000/payments/paystack/callback", {}), "http://localhost:3000/payments/paystack/callback");
assert.equal(callback("https://preview.vercel.app/api/checkout", "https://learn.growvelt.com/payments/paystack/callback", { ...future, NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false" }), "https://learn.growvelt.com/payments/paystack/callback");

const reference = `GS-${"A".repeat(32)}`;
for (const host of ["learn.growvelt.com", "www.growvelt.com"]) {
  for (const kind of ["course", "company", "subscription"]) {
    let writes = 0;
    let providerCalls = 0;
    let supplied;
    let ready = false;
    const rpc = async name => {
      writes++;
      if (name === "get_own_paystack_test_fixture_eligibility") return { data: [{ eligible: true }] };
      if (["initialize_paystack_test_learning_order", "initialize_paystack_live_learning_order"].includes(name)) {
        return { data: [{ order_reference: reference, amount_minor: 10000 }] };
      }
      if (name === "start_learning_company_paid_course_checkout") return { data: [{ provider_reference: reference, amount_minor: 10000 }] };
      if (name === "get_company_test_learning_subscription_plan_for_checkout") return { data: [] };
      if (name === "begin_own_learning_test_subscription_checkout") return { data: [{ outcome: ready ? "ready" : "initialize", authorization_url: ready ? "https://checkout.paystack.com/existing" : null, reference, amount_minor: 10000, subscription_id: "id", invoice_id: "id", plan_code: "PLN_existing" }] };
      if (name === "finish_own_learning_test_subscription_checkout") return { data: "ready" };
      return { data: null };
    };
    const learnerId = "10000000-0000-4000-8000-000000000001";
    const client = { auth: { getUser: async () => ({ data: { user: { id: learnerId, email: "learner@example.invalid" } } }) }, rpc };
    const getConfig = () => ({ mode: "test", checkoutEnabled: true, callbackUrl: "https://learn.growvelt.com/payments/paystack/callback" });
    const initialize = async input => { providerCalls++; supplied = input; return { authorizationUrl: "https://checkout.paystack.com/synthetic" }; };
    const mocks = {
      "server-only": {}, "next/server": { NextResponse },
      "@/app/lib/supabase/server": { createClient: async () => client },
      "@/app/lib/supabase/admin": { createAdminClient: () => client },
      "@/app/lib/security/request-origin": requestOrigin,
      "@/app/lib/email/payment-notifications": {
        getOrderNotificationContext: async () => { throw new Error("Unexpected payment notification lookup."); },
        sendPaymentNotification: async () => { throw new Error("Unexpected payment notification."); },
      },
      "@/app/lib/payments/paystack-config": config,
      "@/app/lib/payments/paystack": { getPaystackConfig: getConfig, getPaystackTestConfig: getConfig, initializePaystackTestTransaction: initialize },
      "@/app/lib/payments/paystack-subscriptions": { initializePaystackTestSubscriptionCheckout: initialize, PaystackTestSubscriptionCheckoutError: class extends Error {} },
      "@/app/lib/subscriptions/feature": { canStartTestSubscriptionCheckout: () => true, canUsePrivateTestSubscriptionCheckout: () => true },
    };
    const path = kind === "course" ? "../app/api/payments/paystack/initialize/route.ts" : kind === "company" ? "../app/api/company/workspaces/[workspaceId]/purchases/[purchaseId]/checkout/route.ts" : "../app/lib/payments/learning-test-subscription-checkout.ts";
    const route = load(path, mocks);
    const body = kind === "course" ? { courseId: 1, callbackUrl: "https://evil.invalid" } : { planId: "20000000-0000-4000-8000-000000000001", requestId: "30000000-0000-4000-8000-000000000001", callbackUrl: "https://evil.invalid" };
    const request = (origin, header = origin) => new Request(`${origin}/api/checkout`, { method: "POST", headers: { origin: header, "content-type": "application/json", "x-forwarded-host": "evil.invalid" }, body: JSON.stringify(body) });
    const invoke = req => kind === "subscription" ? route.handleLearningTestSubscriptionCheckout(req, { privateTestOnly: false }) : route.POST(req, { params: Promise.resolve({ workspaceId: "1", purchaseId: "1" }) });
    assert.equal((await invoke(request(`https://${host}`, "https://evil.invalid"))).status, 403);
    assert.equal(writes, 0);
    assert.equal((await invoke(request("https://evil.invalid"))).status, 503);
    assert.equal(writes, 0);
    assert.equal(providerCalls, 0);
    assert.equal((await invoke(request(`https://${host}`))).status, 200);
    assert.equal(providerCalls, 1);
    assert.equal(supplied.callbackUrl, `https://${host}/payments/paystack/callback?reference=${reference}`);
    assert.equal(supplied.reference, reference);
    assert.equal(supplied.amountMinor, 10000);
    if (kind === "course" && host === "www.growvelt.com") {
      assert.equal((await invoke(request(urls.learningProductionWorkerOrigin, "https://jobs.growvelt.com"))).status, 403);
      assert.equal(providerCalls, 1);
      assert.equal((await invoke(request(urls.learningProductionWorkerOrigin, `https://${host}`))).status, 200);
      assert.equal(providerCalls, 2);
      assert.equal(supplied.callbackUrl, `https://${host}/payments/paystack/callback?reference=${reference}`);
      const liveMocks = { ...mocks, "@/app/lib/payments/paystack": {
        getPaystackConfig: () => ({ ...getConfig(), mode: "live", liveLearnerCheckoutEnabled: true }),
        initializePaystackLiveTransaction: initialize,
      } };
      const liveRoute = (scope) => load(path, liveMocks, { ...future, PAYMENTS_LIVE_LEARNER_CHECKOUT_SCOPE: scope });
      const writesBeforeScopeCheck = writes;
      for (const deniedScope of [learnerId + ":2", "10000000-0000-4000-8000-000000000002:1", ""]) {
        const denied = await liveRoute(deniedScope).POST(request(urls.learningProductionWorkerOrigin, `https://${host}`));
        assert.equal(denied.status, 503);
        assert.equal((await denied.json()).code, "checkout_disabled");
      }
      assert.equal(writes, writesBeforeScopeCheck);
      assert.equal(providerCalls, 2);
      assert.equal((await liveRoute(learnerId + ":1").POST(request(urls.learningProductionWorkerOrigin, `https://${host}`))).status, 200);
      assert.equal(providerCalls, 3);
    }
    if (kind === "subscription") {
      ready = true;
      const response = await invoke(request(`https://${host}`));
      assert.equal((await response.json()).authorizationUrl, "https://checkout.paystack.com/existing");
      assert.equal(providerCalls, 1, "Existing authorization must not be reinitialized");
    }
  }
}
const core = load("../app/lib/payments/paystack-core.ts", { "node:crypto": crypto });
for (const scenario of ["inconclusive", "pending", "cooldown", "abandoned", "paid"]) {
  const reference = `GL-${"A".repeat(32)}`;
  const learnerId = "10000000-0000-4000-8000-000000000001";
  let starts = 0;
  let releases = 0;
  let providerStarts = 0;
  const order = { id: 1, order_reference: reference, status: "payment_pending" };
  const attempt = { status: "pending", paystack_domain: "live", initialized_at: new Date(Date.now() - (scenario === "cooldown" ? 1 : 31) * 60_000).toISOString() };
  const admin = {
    from(table) {
      const query = { select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === "learning_orders" ? order : attempt }) };
      return query;
    },
    async rpc(name) {
      if (name === "initialize_paystack_live_learning_order") {
        return ++starts === 1 ? { error: { code: "23505" } } : { data: [{ order_reference: reference, amount_minor: 10_000 }] };
      }
      if (name === "fail_paystack_live_learning_attempt") releases++;
      if (name === "reconcile_own_paystack_learning_payment") return { data: [{ outcome: "already_paid" }] };
      return {};
    },
  };
  const route = load("../app/api/payments/paystack/initialize/route.ts", {
    "next/server": { NextResponse },
    "@/app/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: learnerId, email: "learner@example.invalid" } } }) } }) },
    "@/app/lib/supabase/admin": { createAdminClient: () => admin },
    "@/app/lib/security/request-origin": requestOrigin,
    "@/app/lib/payments/paystack-config": config,
    "@/app/lib/email/payment-notifications": {},
    "@/app/lib/payments/paystack": {
      getPaystackConfig: () => ({ mode: "live", liveLearnerCheckoutEnabled: true, callbackUrl: "https://www.growvelt.com/payments/paystack/callback" }),
      classifyPaystackCheckoutRecovery: core.classifyPaystackCheckoutRecovery,
      async verifyPaystackTransaction(priorReference, domain) {
        assert.equal(priorReference, reference);
        assert.equal(domain, "live");
        if (scenario === "inconclusive") throw new Error("Lookup unavailable");
        return { reference, domain, status: scenario === "paid" ? "success" : scenario === "cooldown" ? "abandoned" : scenario };
      },
      async initializePaystackLiveTransaction() { providerStarts++; return { authorizationUrl: "https://checkout.paystack.com/retry" }; },
    },
  });
  const response = await route.POST(new Request("https://www.growvelt.com/api/checkout", {
    method: "POST", headers: { origin: "https://www.growvelt.com", "content-type": "application/json" }, body: JSON.stringify({ courseId: 1 }),
  }));
  const result = await response.json();
  assert.equal(releases, scenario === "abandoned" ? 1 : 0);
  assert.equal(providerStarts, scenario === "abandoned" ? 1 : 0);
  if (scenario === "abandoned") assert.equal(result.authorizationUrl, "https://checkout.paystack.com/retry");
  else if (scenario === "paid") assert.equal(result.outcome, "already_paid");
  else {
    assert.equal(response.status, 409);
    assert.equal(result.code, "purchase_pending");
    assert.match(result.message, /select Buy Course again/i);
    assert.doesNotMatch(result.message, /contact support/i);
  }
}

console.log("PASS dual-host checkout, origin and scope checks, existing subscription authorization, and safe course checkout retries (synthetic only).");
