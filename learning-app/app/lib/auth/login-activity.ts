import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getSafeSupabaseError } from "@/app/lib/supabase/logging";
import { scheduleLearningLoginActivityEmail } from "@/app/lib/email/login-activity";

function deviceDetails(userAgent: string) {
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent) ? "Tablet" : /Mobile|iPhone|Android/i.test(userAgent) ? "Mobile" : "Desktop";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  return { device, browser };
}

export async function recordLearningSignIn(user: User, headers: Headers, verifiedSignInAt?: string) {
  const signInAt = verifiedSignInAt ?? user.last_sign_in_at;
  if (!signInAt || !Number.isFinite(Date.parse(signInAt))) return;
  // Password sign-ins are recorded through the authenticated POST endpoint, so
  // their Supabase timestamp must be recent. OAuth code exchange is itself a
  // one-time proof of a fresh sign-in and passes its own trusted timestamp.
  if (!verifiedSignInAt && Math.abs(Date.now() - Date.parse(signInAt)) > 30 * 60 * 1000) return;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("learning.login_activity.database_client_failed", {
      urlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serverKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    });
    throw error;
  }
  const details = deviceDetails(headers.get("user-agent") ?? "");
  const rawCountry = headers.get("x-vercel-ip-country") ?? "";
  const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;
  const { error, status } = await admin.from("learning_login_activity").insert({
    user_id: user.id, sign_in_at: signInAt, ...details, country,
  });
  if (error?.code === "23505") return;
  if (error) {
    console.error("learning.login_activity.history_write_failed", { ...getSafeSupabaseError(error), status });
    throw error;
  }

  scheduleLearningLoginActivityEmail(user, headers, signInAt, details.browser, details.device);

  const { error: notificationError, status: notificationStatus } = await admin.from("learning_notifications").insert({
    user_id: user.id,
    kind: "login",
    title: "New sign-in to your Growvelt account",
    body: `${details.browser} on ${details.device}${country ? ` · ${country}` : ""}. If this wasn't you, reset your password in Settings.`,
    href: "/dashboard/settings",
    source_key: `login:${signInAt}`,
  });
  if (notificationError && notificationError.code !== "23505") {
    console.error("learning.login_activity.bell_write_failed", { ...getSafeSupabaseError(notificationError), status: notificationStatus });
    throw notificationError;
  }
}
