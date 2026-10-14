import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePaystackTestSubscriptionManagementLink } from "../app/lib/payments/paystack-subscription-core.ts";

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

const route = await readFile(new URL("../app/api/payments/paystack/subscriptions/manage/route.ts", import.meta.url), "utf8");
assert.match(route, /supabase\.auth\.getUser\(\)/);
assert.match(route, /\.eq\("learner_id", user\.id\)/);
assert.match(route, /subscription\.payment_domain !== "test"/);
assert.match(route, /\["active", "attention"\]/);
assert.match(route, /getPaystackTestSubscriptionManagementLink/);
assert.match(route, /Referrer-Policy/);
assert.doesNotMatch(route, /\.update\(|\.insert\(|\.delete\(/,
  "opening the Paystack management page must not mutate subscription state");

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

console.log("PASS learner subscription status ownership, safe Paystack manage-link validation, and no-charge management route safeguards");
