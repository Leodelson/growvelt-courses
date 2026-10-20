import "server-only";
import { isIP } from "node:net";
import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";
import { getLearningOrigin, learningAbsoluteUrl } from "@/app/lib/site-urls.mjs";

function cleanHeaderValue(value: string | null, maxLength = 120) {
  if (!value) return "";
  try {
    return decodeURIComponent(value).replace(/[\r\n\t<>]/g, " ").trim().slice(0, maxLength);
  } catch {
    return value.replace(/[\r\n\t<>]/g, " ").trim().slice(0, maxLength);
  }
}

function loginLocation(headers: Headers) {
  const city = cleanHeaderValue(headers.get("x-vercel-ip-city"), 60);
  const region = cleanHeaderValue(headers.get("x-vercel-ip-country-region"), 60);
  const countryCode = headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  let country = "";

  if (/^[A-Z]{2}$/.test(countryCode)) {
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ?? countryCode;
    } catch {
      country = countryCode;
    }
  }

  return [city, region, country].filter(Boolean).join(", ") || "Location unavailable";
}

function loginIpAddress(headers: Headers) {
  const candidates = [headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  return candidates.map((value) => value?.trim() ?? "").find((value) => isIP(value)) ?? "Unavailable";
}

function getGreeting(user: User) {
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return name.split(/\s+/)[0] || "there";
}

function makeLoginEmailHtml(user: User, headers: Headers, signInAt: string, browser: string, device: string) {
  const time = new Date(signInAt);
  const timeFormatter = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
  const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });

  return renderGrowveltEmail({
    baseUrl: getLearningOrigin(),
    greeting: getGreeting(user),
    title: "New login to your Growvelt account",
    paragraphs: ["We noticed a new sign-in to your Growvelt Learning account. Here are the details."],
    details: [
      { label: "Location", value: loginLocation(headers) },
      { label: "Device", value: `${browser} on ${device}` },
      { label: "IP address", value: loginIpAddress(headers) },
      { label: "Time (WAT)", value: `${timeFormatter.format(time)} WAT` },
      { label: "Date", value: dateFormatter.format(time) },
    ],
    primaryAction: { label: "Review account settings", href: learningAbsoluteUrl("/dashboard/settings") },
    reason: "If this was you, no action is needed. If you do not recognize this sign-in, reset your password and contact Growvelt Support. You received this email because a new sign-in was recorded on your Learning account.",
  });
}

async function sendLoginActivityEmail(user: User, headers: Headers, signInAt: string, browser: string, device: string) {
  if (!user.email) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Learning login activity email is not configured.");
    return;
  }

  const signInEpoch = Date.parse(signInAt);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `growvelt-learning-login-${user.id}-${signInEpoch}`,
      },
      body: JSON.stringify({
        from: "Growvelt Login Security <no-reply@growvelt.com>",
        to: [user.email],
        reply_to: "support@growvelt.com",
        subject: "New login to your Growvelt account",
        html: makeLoginEmailHtml(user, headers, signInAt, browser, device),
        tags: [{ name: "category", value: "login_security" }, { name: "product", value: "learning" }],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) console.error("Learning login activity email delivery failed.", response.status);
  } catch {
    console.error("Learning login activity email delivery failed.");
  }
}

export function scheduleLearningLoginActivityEmail(user: User, headers: Headers, signInAt: string, browser: string, device: string) {
  try {
    after(() => sendLoginActivityEmail(user, headers, signInAt, browser, device));
  } catch {
    // A notification-email scheduling failure must never block sign-in.
    console.error("Learning login activity email could not be scheduled.");
  }
}
