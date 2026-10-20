import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/learning/notifications/route.ts", import.meta.url), "utf8");
const navigation = await readFile(new URL("../app/components/learning-shell-navigation.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../app/components/learning-notifications.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const translations = await readFile(new URL("../app/lib/i18n.ts", import.meta.url), "utf8");

assert.match(route, /count: "exact", head: true/ , "the endpoint must return an exact unread notification count");
assert.match(route, /is\("read_at", null\)/, "only unread Learning notifications should count toward the badge");
assert.match(route, /unread_count:/, "the endpoint must expose unread_count for the badge");
assert.match(navigation, /setTimeout\(\(\) => \{ void refreshNotifications\(controller\.signal\); \}, 0\)/, "notification data should be prefetched as soon as the dashboard shell mounts");
assert.match(navigation, /if \(panel === "notifications"\) void refreshNotifications\(\)/, "opening the popover should refresh its cached list in the background");
assert.match(navigation, /dashboard-notification-badge/, "the bell should display an unread badge");
assert.match(navigation, /setUnreadNotificationCount\(\(current\) => Math\.max\(0, current - 1\)\)/, "marking an unread item read should decrement the badge");
assert.match(component, /items, state, onClose, onMarkRead/, "the popover should render its prefetched notification data immediately");
assert.match(styles, /\.dashboard-notification-badge[^{]*\{[^}]*background: #e11d48/s, "the badge should use a visible red notification color");
assert.match(translations, /"public\.signUp": "Join for free"/, "the English public join CTA should say Join for free");
assert.match(translations, /"public\.signUp": "Rejoindre gratuitement"/, "the French public join CTA should be localized");
assert.match(translations, /"public\.signUp": "Únete gratis"/, "the Spanish public join CTA should be localized");

console.log("PASS Learning unread badge, prefetched notification list, read-count updates, and public join CTA");
