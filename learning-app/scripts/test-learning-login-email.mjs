import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const email = await readFile(new URL("../app/lib/email/login-activity.ts", import.meta.url), "utf8");
const activity = await readFile(new URL("../app/lib/auth/login-activity.ts", import.meta.url), "utf8");
const template = await readFile(new URL("../app/lib/email/growvelt-email-template.ts", import.meta.url), "utf8");
const authRoute = await readFile(new URL("../app/api/auth/login-activity/route.ts", import.meta.url), "utf8");
const oauthCallback = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");

assert.match(activity, /if \(error\?\.code === "23505"\) return;/, "a duplicate sign-in record must not trigger a second alert");
assert.match(activity, /scheduleLearningLoginActivityEmail\(user, headers, signInAt, details\.browser, details\.device\)/, "new Learning sign-ins must schedule the security email");
assert.match(email, /after\(\(\) => sendLoginActivityEmail/, "email delivery should run after the authentication response");
assert.match(email, /to: \[user\.email\]/, "the message must go only to the authenticated user's email");
assert.match(email, /Idempotency-Key.*growvelt-learning-login-\$\{user\.id\}-\$\{signInEpoch\}/s, "delivery must be idempotent per user and sign-in time");
assert.match(email, /New login to your Growvelt account/, "the subject and title should use the Careers security-alert wording");
assert.match(email, /Review account settings/ , "the email must provide a Learning account-settings action");
assert.match(email, /learningAbsoluteUrl\("\/dashboard\/settings"\)/, "the CTA must resolve to Learning settings, not Careers");
assert.match(email, /Location|Device|IP address|Time \(WAT\)|Date/, "the email should include sign-in details");
assert.match(email, /If this was you, no action is needed/, "the email must include the security guidance");
assert.match(email, /category", value: "login_security".*product", value: "learning"/s, "the alert must be tagged as Learning transactional security email");
assert.match(template, /input\.details\?\.length/, "the shared email renderer must support an optional sign-in details table");
assert.match(template, /escapeEmailHtml\(detail\.label\).*escapeEmailHtml\(detail\.value\)/s, "detail values must be escaped before rendering");
assert.match(authRoute, /recordLearningSignIn\(user, request\.headers\)/, "password sign-ins must create the email-triggering record");
assert.match(oauthCallback, /recordLearningSignIn\(data\.session\.user, request\.headers, new Date\(\)\.toISOString\(\)\)/, "OAuth sign-ins must create the email-triggering record");

console.log("PASS Learning login security email uses Careers-style branding, Learning-only links, idempotent delivery, and both sign-in flows");
