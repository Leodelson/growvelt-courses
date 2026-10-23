import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const origin = "https://www.growvelt.com", id = "00000000-0000-4000-8000-000000000001";
let actor = { id, email_confirmed_at: "2026-10-22" }, authError = null, databaseError = null, privilegedCalls = 0;
const operations = [];
function load(path) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: mod.exports, URL, URLSearchParams, TextDecoder, require: name => {
    if (name === "@/app/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: actor }, error: authError }) } }) };
    if (name === "@/app/lib/supabase/admin") return { createAdminClient: () => { privilegedCalls++; return { rpc: async (rpc, args) => { operations.push({ rpc, args }); return { data: null, error: databaseError }; }, from: () => { throw new Error("Direct consent writes are forbidden"); } }; } };
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
    return require(name);
  } }); return mod.exports;
}
const preference = load("app/api/learning/email/preferences/route.ts"), unsubscribe = load("app/api/learning/email/unsubscribe/route.ts");
const settings = body => new Request(`${origin}/api/learning/email/preferences`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
assert.equal((await preference.POST(settings({ marketingOptIn: false, userId: "spoofed" }))).status, 200);
assert.deepEqual(JSON.parse(JSON.stringify(operations.at(-1))), { rpc: "set_learning_email_preference", args: { p_user_id: id, p_opt_in: false, p_source: "settings" } });
actor = { id };
assert.equal((await preference.POST(settings({ marketingOptIn: true }))).status, 401);
actor = { id, email_confirmed_at: "2026-10-22" }; authError = new Error("session rejected");
assert.equal((await preference.POST(settings({ marketingOptIn: true }))).status, 401); authError = null;
databaseError = { code: "42883" };
assert.equal((await preference.POST(settings({ marketingOptIn: true }))).status, 503, "missing migration never falls back to unaudited write"); databaseError = null;
const beforeRead = privilegedCalls;
assert.equal((await unsubscribe.GET(new Request(`${origin}/api/learning/email/unsubscribe?token=${id}`))).status, 200);
assert.equal(privilegedCalls, beforeRead, "opening an email link never unsubscribes automatically");
const form = (body, headers = {}) => new Request(`${origin}/api/learning/email/unsubscribe`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body });
const success = await unsubscribe.POST(form(`token=${id}`));
assert.equal(success.status, 200); assert.equal(success.headers.get("referrer-policy"), "no-referrer");
assert.equal(operations.at(-1).rpc, "unsubscribe_learning_email_token"); assert.equal(operations.at(-1).args.p_token, id);
for (const [body, headers, expected] of [[`token=${id}&token=${id}`, {}, 400], ["token=invalid", {}, 400], [`token=${id}&padding=${"x".repeat(1100)}`, { "Content-Length": "1" }, 413], [`token=${id}`, { "Content-Type": "text/plain" }, 415]]) {
  const before = privilegedCalls;
  assert.equal((await unsubscribe.POST(form(body, headers))).status, expected);
  assert.equal(privilegedCalls, before, "invalid public requests never create the privileged client");
}
databaseError = { code: "42883" };
assert.equal((await unsubscribe.POST(form(`token=${id}`))).status, 503);
console.log("PASS actual consent API handlers with fakes: verified session/ownership, no unaudited fallback, GET no mutation, bounded unsubscribe form, duplicate token/type rejection and database failure. No hosted/provider access.");
