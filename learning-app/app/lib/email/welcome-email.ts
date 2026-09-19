import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";

const welcomeSentAtKey = "growvelt_learning_welcome_email_sent_at";
const welcomePendingKey = "growvelt_learning_welcome_email_pending";
const newAccountWindowMs = 30 * 60 * 1000;

function getFirstName(user: User) {
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return name.split(/\s+/)[0] || "there";
}

function isEligibleForWelcomeEmail(user: User) {
  if (!user.created_at || user.user_metadata?.[welcomeSentAtKey]) return false;
  if (user.user_metadata?.[welcomePendingKey] === true) return true;
  const createdAt = Date.parse(user.created_at);
  return Number.isFinite(createdAt) && Date.now() - createdAt <= newAccountWindowMs;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function welcomeEmailHtml(firstName: string, appBaseUrl: string) {
  const learningUrl = new URL("/dashboard/explore", appBaseUrl).href;
  const jobsUrl = "https://growvelt.com";
  return renderGrowveltEmail({
    baseUrl: appBaseUrl,
    greeting: firstName,
    title: "Welcome to Growvelt",
    paragraphs: ["Your account is ready. Explore practical courses, build skills at your pace, and keep your learning progress in one place."],
    primaryAction: { label: "Explore Learning", href: learningUrl },
    secondaryAction: { label: "Explore Growvelt Jobs", href: jobsUrl },
    highlights: ["Discover practical courses and learn at your pace", "Track progress and complete learning activities", "Build a record of skills and earned proof"],
    reason: "You received this email because you created a Growvelt account.",
  });
}

export async function sendWelcomeEmailForEligibleAccount(user: User, appBaseUrl: string) {
  if (!isEligibleForWelcomeEmail(user) || !user.email) return;

  const apiKey = process.env.RESEND_API_KEY;
  const admin = getAdminClient();
  if (!apiKey || !admin) {
    console.warn("Growvelt welcome email is not configured.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "growvelt-learning/1.0",
      "Idempotency-Key": `growvelt-learning-welcome-${user.id}`,
    },
    body: JSON.stringify({
      from: "Growvelt <no-reply@growvelt.com>",
      to: [user.email],
      reply_to: "support@growvelt.com",
      subject: "Welcome to Growvelt",
      html: welcomeEmailHtml(getFirstName(user), appBaseUrl),
      tags: [{ name: "category", value: "welcome" }, { name: "product", value: "learning" }],
    }),
  });

  if (!response.ok) {
    console.error("Growvelt welcome email could not be sent.", response.status);
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, [welcomePendingKey]: false, [welcomeSentAtKey]: new Date().toISOString() },
  });
  if (error) console.error("Growvelt welcome email was sent, but its delivery marker could not be saved.");
}
