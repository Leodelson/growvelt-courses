import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { careersAbsoluteUrl } from "../app/lib/site-urls.mjs";

const component = readFileSync(new URL("../app/components/learning-help-assistant.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/components/learning-help-assistant.module.css", import.meta.url), "utf8");
const supportRoute = readFileSync(new URL("../app/api/learning/support/route.ts", import.meta.url), "utf8");
const cutover = {
  NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com",
  NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com",
  NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true",
};

assert.equal(careersAbsoluteUrl("/updates", cutover), "https://jobs.growvelt.com/updates");
assert.match(component, /growvelt-help-welcome-dismissed/);
assert.match(component, /Hello there!/);
assert.match(component, /Let&rsquo;s chat now/);
assert.match(component, /role="tablist"/);
for (const tab of ["Guide", "Messages", "Updates"]) assert.ok(component.includes(`>${tab}</span>`), `${tab} tab should be present`);
assert.match(component, /careersAbsoluteUrl\("\/updates"\)/, "Updates must use the configured Careers origin");
assert.match(component, /href="\/dashboard\/support"/, "Messages must stay in Learning support");
assert.match(component, /api\/learning\/support/, "Messages should load only Learning support threads");
assert.match(supportRoute, /\.eq\("user_id", user\.id\)/, "the recent-message list must be scoped to the signed-in Learning user");
assert.match(supportRoute, /private, no-store/, "private support previews must not be cached");
assert.match(component, /sessionStorage\.setItem\(welcomeDismissedKey/);
assert.match(styles, /@media \(max-width: 700px\)/, "assistant must have a mobile layout");
assert.match(styles, /safe-area-inset-bottom/, "mobile layout must respect device safe areas");
assert.ok(existsSync(new URL("../public/images/learning-help-assistant-female.png", import.meta.url)));
assert.ok(existsSync(new URL("../public/images/learning-help-assistant-male.png", import.meta.url)));

console.log("PASS Learning Help Assistant tabs, Careers Updates destination, Learning support isolation, avatars, and responsive layout");
