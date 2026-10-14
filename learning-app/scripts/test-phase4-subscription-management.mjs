import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePaystackTestSubscriptionListPage, parsePaystackTestSubscriptionManagementLink } from "../app/lib/payments/paystack-subscription-core.ts";

const validLink = "https://paystack.com/manage/subscriptions/Abcdef123?subscription_token=opaque-token-value";
assert.equal(parsePaystackTestSubscriptionManagementLink({ status: true, data: { link: validLink } }), validLink);
for (const invalid of [
  { status: false, data: { link: validLink } },
  { status: true, data: { link: "http://paystack.com/manage/subscriptions/Abcdef123?subscription_token=x" } },
  { status: true, data: { link: "https://paystack.com.attacker.example/manage/subscriptions/Abcdef123?subscription_token=x" } },
  { status: true, data: { link: "https://attacker.example/manage/subscriptions/Abcdef123?subscription_token=x" } },
  { status: true, data: { link: "https://user:pass@paystack.com/manage/subscriptions/Abcdef123?subscription_token=x" } },
  { status: true, data: { link: "https://paystack.com/redirect?subscription_token=x" } },
  { status: true, data: { link: "https://paystack.com/manage/subscriptions/Abcdef123" } },
  { status: true, data: { link: "https://paystack.com/manage/subscriptions/Abcdef123?subscription_token=x#fragment" } },
  null,
]) assert.equal(parsePaystackTestSubscriptionManagementLink(invalid), null);

const expectedSubscription = { email: "motivationsteelmgt@gmail.com", planCode: "PLN_1234567890", amountMinor: 10000 };
const providerSubscription = {
  subscription_code: "SUB_1234567890",
  status: "active",
  domain: "test",
  amount: 10000,
  customer: { email: "motivationsteelmgt@gmail.com", domain: "test" },
  plan: { plan_code: "PLN_1234567890", domain: "test", amount: 10000, currency: "NGN", interval: "monthly" },
};
const subscriptionPage = { status: true, meta: { page: 1, pageCount: 1 }, data: [providerSubscription] };
assert.deepEqual(parsePaystackTestSubscriptionListPage(subscriptionPage, expectedSubscription), {
  subscriptionCodes: ["SUB_1234567890"], page: 1, pageCount: 1,
});
for (const mutate of [
  (record) => { record.customer.email = "someone-else@example.com"; },
  (record) => { record.plan.plan_code = "PLN_different1"; },
  (record) => { record.domain = "live"; },
  (record) => { record.plan.domain = "live"; },
  (record) => { record.status = "cancelled"; },
  (record) => { record.amount = 5000; },
  (record) => { record.plan.currency = "USD"; },
  (record) => { record.plan.interval = "annually"; },
  (record) => { record.subscription_code = "SUB_"; },
]) {
  const record = structuredClone(providerSubscription);
  mutate(record);
  const parsed = parsePaystackTestSubscriptionListPage({ ...subscriptionPage, data: [record] }, expectedSubscription);
  assert.deepEqual(parsed?.subscriptionCodes, [], "non-matching or malformed provider entries must not be linked");
}
assert.equal(parsePaystackTestSubscriptionListPage({ ...subscriptionPage, meta: { page: 0, pageCount: 1 } }, expectedSubscription), null);
assert.equal(parsePaystackTestSubscriptionListPage({ ...subscriptionPage, status: false }, expectedSubscription), null);

const route = await readFile(new URL("../app/api/payments/paystack/subscriptions/manage/route.ts", import.meta.url), "utf8");
assert.match(route, /supabase\.auth\.getUser\(\)/);
assert.match(route, /\.eq\("learner_id", user\.id\)/);
assert.match(route, /subscription\.payment_domain !== "test"/);
assert.match(route, /\["active", "attention"\]/);
assert.match(route, /getPaystackTestSubscriptionManagementLink/);
assert.match(route, /findPaystackTestSubscriptionCode/);
assert.match(route, /Referrer-Policy/);
assert.doesNotMatch(route, /\.update\(|\.insert\(|\.delete\(/,
  "opening the Paystack management page must not mutate subscription state");

const page = await readFile(new URL("../app/dashboard/subscriptions/page.tsx", import.meta.url), "utf8");
assert.match(page, /className=\{`back-link \$\{styles\.back\}`\}[\s\S]*?href="\/dashboard\/my-learning"[\s\S]*?<header/,
  "the Back to My Learning link belongs above the subscription page header");
assert.match(page, /<div className=\{styles\.footer\}>\{text\.end\}<\/div>/);
assert.doesNotMatch(page, /styles\.footer[\s\S]{0,160}href="\/dashboard\/my-learning"/,
  "the footer should not contain the Back to My Learning link");

const styles = await readFile(new URL("../app/components/learning/subscriptions.module.css", import.meta.url), "utf8");
assert.match(styles, /\.footer\s*\{[^}]*justify-content:\s*center/s);
assert.doesNotMatch(styles, /\.footer\s*\{[^}]*flex-direction:\s*column/s,
  "the footer should remain centered on narrow screens");

const translations = await readFile(new URL("../app/lib/i18n.ts", import.meta.url), "utf8");
assert.match(translations, /"nav\.subscriptions": "My subscriptions"/);
assert.match(translations, /"nav\.subscriptions": "Mes abonnements"/);
assert.match(translations, /"nav\.subscriptions": "Mis suscripciones"/);

const provider = await readFile(new URL("../app/lib/payments/paystack-subscriptions.ts", import.meta.url), "utf8");
const lookup = provider.slice(provider.indexOf("export async function findPaystackTestSubscriptionCode"));
assert.match(lookup, /getPaystackTestConfig\(false\)/);
assert.match(lookup, /method:\s*"GET"/);
assert.doesNotMatch(lookup, /method:\s*"POST"|method:\s*"PUT"|method:\s*"DELETE"/,
  "recovery must remain read-only against Paystack");
assert.match(lookup, /matches\.size > 1/,
  "ambiguous provider matches must fail closed");

const migration = await readFile(
  new URL("../supabase/migrations/20261031000000_list_own_learning_subscriptions.sql", import.meta.url),
  "utf8",
);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path to ''/i);
assert.match(migration, /subscription\.learner_id = auth\.uid\(\)/i);
assert.match(migration, /paystack_subscription_code is not null/i);
assert.match(migration, /revoke all on function public\.list_own_learning_subscriptions\(\)[\s\S]*from public, anon, service_role/i);
assert.match(migration, /grant execute on function public\.list_own_learning_subscriptions\(\)[\s\S]*to authenticated/i);
assert.doesNotMatch(migration, /returns table\([^)]*paystack_subscription_code/i,
  "the learner-facing projection must not expose provider subscription identifiers");

console.log("PASS learner subscription ownership, exact Test Mode provider matching, safe Paystack management links, and responsive page/navigation layout");
