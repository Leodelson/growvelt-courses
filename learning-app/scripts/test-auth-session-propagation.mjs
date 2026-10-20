import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getSafeSupabaseError } = await import("../app/lib/supabase/logging.ts");
const { propagateAuthCookies } = await import("../app/lib/supabase/auth-callback.ts");
const { getSafeNextPath } = await import("../app/lib/auth/redirect.ts");

function cookieTarget() {
  const writes = [];
  return { writes, set(name, value, options) { writes.push({ name, value, options }); } };
}

const exchangedCookies = [
  { name: "sb-access-token", value: "access-value", options: { httpOnly: true, path: "/", sameSite: "lax" } },
  { name: "sb-refresh-token", value: "refresh-value", options: { httpOnly: true, path: "/", sameSite: "lax" } },
];

for (const accountKind of ["first_google_login", "existing_google_login"]) {
  const requestCookies = cookieTarget();
  const responseCookies = cookieTarget();
  propagateAuthCookies(exchangedCookies, requestCookies, responseCookies);
  assert.equal(requestCookies.writes.length, 2, `${accountKind}: immediate request cookie view was not updated`);
  assert.deepEqual(responseCookies.writes, exchangedCookies, `${accountKind}: redirect response lost session cookie options`);
}

assert.equal(getSafeNextPath("/dashboard"), "/dashboard");
assert.equal(getSafeNextPath("/dashboard/admin/payments"), "/dashboard/admin/payments");
assert.equal(getSafeNextPath("https://evil.invalid/dashboard"), "/dashboard");
assert.deepEqual(getSafeSupabaseError({ code: "42501", status: 403, message: "private detail" }), { code: "42501", status: 403 });

const route = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
const learningRoute = await readFile(new URL("../app/auth/learning/callback/route.ts", import.meta.url), "utf8");
const authForm = await readFile(new URL("../app/components/auth/auth-form.tsx", import.meta.url), "utf8");
const loginActivity = await readFile(new URL("../app/lib/auth/login-activity.ts", import.meta.url), "utf8");
const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
assert.match(route, /createAuthCallbackClient\(request, response\)/, "OAuth callback must bind cookie writes to its redirect response");
assert.match(route, /exchangeCodeForSession\(code\)/, "OAuth callback must exchange the PKCE code before redirecting");
assert.match(route, /!data\.session/, "OAuth callback must reject an exchange without a session");
assert.match(route, /recordLearningSignIn\(data\.session\.user, request\.headers, new Date\(\)\.toISOString\(\)\)/, "a successful OAuth exchange must record a fresh sign-in even if Supabase omits its timestamp");
assert.match(learningRoute, /export \{ GET \} from ["']\.\.\/\.\.\/callback\/route["']/, "the Learning callback alias must use the same OAuth activity recorder");
assert.match(authForm, /api\/auth\/login-activity/, "email/password sign-in must also record activity");
assert.match(authForm, /signInWithOAuth\(\{[\s\S]*?provider:\s*["']google["'][\s\S]*?redirectTo:\s*callback[\s\S]*?queryParams:\s*\{\s*prompt:\s*["']select_account["']\s*\}/, "Google sign-in must preserve the Learning callback and request the account chooser");
assert.match(loginActivity, /verifiedSignInAt/, "trusted callback timestamps must bypass only the password-session freshness check");
assert.match(route, /return response;/, "OAuth callback must return the cookie-bearing response");
assert.match(proxy, /isProtectedPath && !isAuthenticated/, "Signed-out protected-route denial is missing");
assert.match(proxy, /guestOnlyPaths\.has\(pathname\) && isAuthenticated/, "Authenticated guest-route redirect protection is missing");

console.log("PASS OAuth callback cookie propagation, safe redirect, hard-navigation, signed-out denial, and no-loop regression checks");
