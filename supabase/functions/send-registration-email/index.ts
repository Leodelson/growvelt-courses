import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseRest } from "../_shared/supabase.ts";

type Registration = {
  id?: number;
  registration_ref?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  course?: string;
  learning_mode?: string;
  experience_level?: string;
  message?: string;
};

const adminEmail = Deno.env.get("ADMIN_EMAIL") || "admin@growvelt.com";
const fromEmail = Deno.env.get("EMAIL_FROM") || "Growvelt Courses <onboarding@resend.dev>";
const siteUrl = (Deno.env.get("SITE_URL") || "https://courses.growvelt.com").replace(/\/$/, "");
const contactUrl = `${siteUrl}/contact.html`;
const coursesUrl = `${siteUrl}/courses.html`;
const logoUrl = Deno.env.get("EMAIL_LOGO_URL") || `${siteUrl}/images/growveltlogo%20new.png`;

function escapeHtml(value?: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function emailShell(content: string, reason: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f7fb;">
      <tr>
        <td align="center" style="padding:40px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:12px;padding:32px;border-collapse:separate;">
            <tr>
              <td align="center" style="padding:0 0 24px;">
                <img
                  src="${logoUrl}"
                  alt="Growvelt"
                  style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"
                />
              </td>
            </tr>
            ${content}
            <tr>
              <td style="color:#374151;font-size:14px;line-height:1.6;padding-top:16px;">
                <p style="margin:0 0 10px;">
                  <strong>Need help?</strong>
                  <a href="${contactUrl}" target="_blank" style="color:#6d28d9;text-decoration:none;font-weight:bold;">Contact Us</a>
                </p>
                <p style="margin:0;">
                  <strong>Follow us:</strong>
                  <a href="https://www.linkedin.com/company/growvelt" target="_blank" style="margin-right:10px;color:#6d28d9;text-decoration:none;">LinkedIn</a>
                  <a href="https://web.facebook.com/growvelttechnologies09?_rdc=1&_rdr#" target="_blank" style="margin-right:10px;color:#6d28d9;text-decoration:none;">Facebook</a>
                  <a href="https://www.instagram.com/growvelt/#" target="_blank" style="color:#6d28d9;text-decoration:none;">Instagram</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;text-align:center;padding-top:24px;">
                <p style="margin:0;">${reason}</p>
                <p style="margin:12px 0 0;">
                  &copy; ${new Date().getFullYear()} Growvelt Technologies Limited (RC - 8738218) | All rights reserved
                  <br />
                  Tech skills made practical
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function studentHtml(registration: Registration) {
  const name = escapeHtml(registration.full_name || "there");
  const course = escapeHtml(registration.course || "a Growvelt course");
  const learningMode = escapeHtml(registration.learning_mode || "Not specified");

  return emailShell(
    `
            <tr>
              <td style="color:#111827;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 14px;">Hello <strong>${name}</strong>,</p>
                <p style="margin:0 0 16px;">
                  Thank you for registering for <strong>${course}</strong>. We have received your course registration and our team will contact you with the class schedule, payment confirmation, and next steps.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 0;">
                <span style="display:inline-block;padding:10px 18px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-weight:bold;font-size:14px;">
                  Registration received
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0 18px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
                  <tr>
                    <td style="padding:16px 18px;color:#374151;font-size:14px;line-height:1.6;">
                      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;">Course</p>
                      <p style="margin:0;color:#111827;font-size:17px;font-weight:bold;">${course}</p>
                      <p style="margin:12px 0 0;">Preferred learning mode: <strong>${learningMode}</strong></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 0 24px;">
                <a href="${contactUrl}" target="_blank" style="background:#6d28d9;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                  Contact Us
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#374151;font-size:14px;line-height:1.6;">
                <hr style="margin:0 0 20px;border:none;border-top:1px solid #e5e7eb;" />
                <p style="margin:0 0 10px;">Want to explore more in-demand tech skills with Growvelt?</p>
                <p style="margin:0;">
                  <a href="${coursesUrl}" target="_blank" style="color:#6d28d9;font-weight:bold;text-decoration:none;">
                    Explore our courses
                  </a>
                </p>
              </td>
            </tr>
    `,
    "You received this email because you registered for a course on Growvelt.",
  );
}

function adminHtml(registration: Registration) {
  const name = escapeHtml(registration.full_name);
  const email = escapeHtml(registration.email);
  const phone = escapeHtml(registration.phone);
  const course = escapeHtml(registration.course);
  const learningMode = escapeHtml(registration.learning_mode);
  const experienceLevel = escapeHtml(registration.experience_level);
  const message = escapeHtml(registration.message);

  return emailShell(
    `
            <tr>
              <td style="color:#111827;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 14px;"><strong>New course registration received.</strong></p>
                <p style="margin:0 0 16px;">A student submitted a registration for <strong>${course || "a Growvelt course"}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 0;">
                <span style="display:inline-block;padding:10px 18px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-weight:bold;font-size:14px;">
                  New registration
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0 18px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;color:#374151;font-size:14px;line-height:1.6;">
                  <tr><td style="padding:10px 0;color:#6b7280;width:150px;">Name</td><td style="padding:10px 0;font-weight:bold;color:#111827;">${name}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Email</td><td style="padding:10px 0;"><a href="mailto:${email}" style="color:#6d28d9;text-decoration:none;font-weight:bold;">${email}</a></td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Phone</td><td style="padding:10px 0;">${phone}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Course</td><td style="padding:10px 0;font-weight:bold;color:#111827;">${course}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Learning mode</td><td style="padding:10px 0;">${learningMode}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Experience level</td><td style="padding:10px 0;">${experienceLevel}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="color:#374151;font-size:14px;line-height:1.6;">
                <div style="padding:16px 18px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
                  <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;">Message</p>
                  <p style="margin:0;">${message || "No message provided."}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <a href="mailto:${email}" style="background:#6d28d9;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                  Reply to Applicant
                </a>
              </td>
            </tr>
    `,
    "You received this email because a student registered for a course on Growvelt.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { registration } = await req.json();
    const data = registration as Registration;

    if (!data?.email || !data?.course) {
      return jsonResponse({ error: "Missing registration email or course" }, 400);
    }

    await sendEmail(
      data.email,
      `Growvelt registration received: ${data.course}`,
      studentHtml(data),
    );

    await sendEmail(
      adminEmail,
      `New Growvelt course registration: ${data.course}`,
      adminHtml(data),
    );

    if (data.registration_ref) {
      await supabaseRest(`course_registrations?registration_ref=eq.${encodeURIComponent(data.registration_ref)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          email_sent_at: new Date().toISOString(),
          admin_notified_at: new Date().toISOString(),
        }),
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: "Email function failed", details }, 500);
  }
});
