import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isLearningNotificationVisible,
  LOGIN_NOTIFICATION_RETENTION_MS,
  loginNotificationExpiresAt,
} from "../app/lib/learning/notification-retention.ts";

const now = Date.parse("2026-10-20T12:00:00.000Z");
const readAt = new Date(now - 23 * 60 * 60 * 1000).toISOString();
assert.equal(LOGIN_NOTIFICATION_RETENTION_MS, 24 * 60 * 60 * 1000);
assert.equal(isLearningNotificationVisible({ kind: "login", read_at: readAt }, now), true, "a read sign-in alert remains visible for its first 24 hours");
assert.equal(isLearningNotificationVisible({ kind: "login", read_at: new Date(now - LOGIN_NOTIFICATION_RETENTION_MS).toISOString() }, now), false, "a read sign-in alert expires at 24 hours");
assert.equal(isLearningNotificationVisible({ kind: "login", read_at: null }, now), true, "unread sign-in alerts do not expire");
assert.equal(isLearningNotificationVisible({ kind: "course", read_at: new Date(now - 7 * LOGIN_NOTIFICATION_RETENTION_MS).toISOString() }, now), true, "other notification types are unaffected");
assert.equal(isLearningNotificationVisible({ kind: "login", read_at: "not-a-date" }, now), true, "invalid timestamps fail safe and remain visible");
assert.equal(loginNotificationExpiresAt(null), null);

const [route, provider, layout] = await Promise.all([
  readFile(new URL("../app/api/learning/notifications/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/components/theme-provider.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
]);
assert.match(route, /\.eq\("kind", LOGIN_NOTIFICATION_KIND\).*\.limit\(1\)\.maybeSingle\(\)/, "the API fetches only the newest sign-in notice");
assert.match(route, /\.neq\("kind", LOGIN_NOTIFICATION_KIND\)\.is\("read_at", null\)/, "older login notices are excluded from the unread count");
assert.match(route, /isLearningNotificationVisible\(latestLogin, Date.now\(\)\)/, "the latest login notice still expires after it is read");
assert.match(provider, /useState<Theme>\("light"\)/, "a new visitor starts with light theme");
assert.match(provider, /: "light";/, "missing saved preferences fall back to light");
assert.match(layout, /: "light";/, "the pre-hydration theme bootstrap also falls back to light");

console.log("PASS light first-visit theme and 24-hour read sign-in notification retention");
