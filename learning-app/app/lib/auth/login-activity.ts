import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/lib/supabase/admin";

function deviceDetails(userAgent: string) {
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent) ? "Tablet" : /Mobile|iPhone|Android/i.test(userAgent) ? "Mobile" : "Desktop";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  return { device, browser };
}

export async function recordLearningSignIn(user: User, headers: Headers) {
  const signInAt = user.last_sign_in_at;
  if (!signInAt || !Number.isFinite(Date.parse(signInAt))) return;
  // Only a fresh authentication event can create a receipt. A dashboard refresh cannot.
  if (Math.abs(Date.now() - Date.parse(signInAt)) > 30 * 60 * 1000) return;

  const admin = createAdminClient();
  const details = deviceDetails(headers.get("user-agent") ?? "");
  const rawCountry = headers.get("x-vercel-ip-country") ?? "";
  const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;
  const { error } = await admin.from("learning_login_activity").insert({
    user_id: user.id, sign_in_at: signInAt, ...details, country,
  });
  if (error?.code === "23505") return;
  if (error) throw error;

  const { error: notificationError } = await admin.from("learning_notifications").insert({
    user_id: user.id,
    kind: "login",
    title: "New sign-in to your Learning account",
    body: `${details.browser} on ${details.device}${country ? ` · ${country}` : ""}. If this wasn't you, reset your password in Settings.`,
    href: "/dashboard/settings",
    source_key: `login:${signInAt}`,
  });
  if (notificationError && notificationError.code !== "23505") throw notificationError;
}
