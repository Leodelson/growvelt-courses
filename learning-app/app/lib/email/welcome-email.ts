import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const welcomeSentAtKey = "growvelt_learning_welcome_email_sent_at";
const newAccountWindowMs = 10 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function getFirstName(user: User) {
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return name.split(/\s+/)[0] || "there";
}

function isNewlyEstablishedAccount(user: User) {
  if (!user.created_at || user.user_metadata?.[welcomeSentAtKey]) return false;
  const createdAt = Date.parse(user.created_at);
  const signedInAt = Date.parse(user.last_sign_in_at ?? "");
  return Number.isFinite(createdAt) && Number.isFinite(signedInAt) && Math.abs(signedInAt - createdAt) <= newAccountWindowMs;
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
  const year = new Date().getFullYear();

  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f3f1f6;color:#ffffff;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f3f1f6"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#202126;border:1px solid #32343c;border-radius:16px;overflow:hidden"><tr><td style="padding:34px 32px 20px"><img src="${escapeHtml(new URL("/logo/Growvelt%20Logo.png", appBaseUrl).href)}" width="150" alt="Growvelt" style="display:block;width:150px;max-width:100%;height:auto;border:0" /></td></tr><tr><td style="padding:8px 32px 34px"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#f7f5fa">Hello ${escapeHtml(firstName)},</p><h1 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:#ffffff">Welcome to Growvelt</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#dedbe5">Your account is ready. Explore practical courses, build skills at your pace, and keep your learning progress in one place.</p><table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 26px"><tr><td style="border-radius:9px;background:linear-gradient(90deg,#8b20d7,#cc4bd9)"><a href="${escapeHtml(learningUrl)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Explore Learning&nbsp; →</a></td></tr></table><p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#ffffff">With Growvelt, you can:</p><ul style="margin:0;padding-left:20px;color:#dedbe5;font-size:14px;line-height:1.75"><li>Discover practical courses and learn at your pace</li><li>Track progress and complete learning activities</li><li>Build a record of skills and earned proof</li></ul><p style="margin:26px 0 0"><a href="${escapeHtml(jobsUrl)}" style="color:#d69aff;font-size:14px;font-weight:700;text-decoration:none">Explore Growvelt Jobs →</a></p><div style="height:1px;margin:30px 0 20px;background:#3a3c44"></div><p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#b5b1bd">Need help? <a href="mailto:support@growvelt.com" style="color:#d69aff">Contact us</a></p><p style="margin:0;font-size:12px;line-height:1.6;color:#9995a2">Follow us: <a href="https://www.linkedin.com/company/growvelt" style="color:#c9a6dc">LinkedIn</a> · <a href="https://www.facebook.com/growvelt" style="color:#c9a6dc">Facebook</a> · <a href="https://www.instagram.com/growvelt" style="color:#c9a6dc">Instagram</a><br />© ${year} Growvelt Technologies Limited (RC - 8738218). All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}

export async function sendWelcomeEmailForNewAccount(user: User, appBaseUrl: string) {
  if (!isNewlyEstablishedAccount(user) || !user.email) return;

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
    user_metadata: { ...user.user_metadata, [welcomeSentAtKey]: new Date().toISOString() },
  });
  if (error) console.error("Growvelt welcome email was sent, but its delivery marker could not be saved.");
}
