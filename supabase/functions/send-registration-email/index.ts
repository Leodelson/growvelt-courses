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

function studentHtml(registration: Registration) {
  const name = escapeHtml(registration.full_name || "there");
  const course = escapeHtml(registration.course || "a Growvelt course");
  const learningMode = escapeHtml(registration.learning_mode || "Not specified");
  return `
    <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden">
              <tr>
                <td style="padding:26px 28px 18px;background:#2b0648">
                  <img src="${logoUrl}" alt="Growvelt" width="190" style="display:block;max-width:190px;height:auto;margin-bottom:18px">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.3">Registration received</h1>
                  <p style="margin:8px 0 0;color:#e9d7fe;font-size:15px">Your Growvelt course registration is now in our system.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:28px">
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.7">Hello ${name},</p>
                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7">Thank you for registering for <strong>${course}</strong>. Our team has received your application and will contact you with the class schedule, payment confirmation, and next steps.</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #e4e7ec;border-radius:10px;background:#f9fafb">
                    <tr>
                      <td style="padding:16px 18px">
                        <p style="margin:0 0 8px;color:#667085;font-size:13px;font-weight:bold;text-transform:uppercase">Course</p>
                        <p style="margin:0;color:#172033;font-size:17px;font-weight:bold">${course}</p>
                        <p style="margin:12px 0 0;color:#475467;font-size:14px">Preferred mode: ${learningMode}</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475467">If you have a question before we reach out, contact the Growvelt Courses team directly.</p>
                  <a href="${contactUrl}" style="display:inline-block;background:#ff920f;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px">Contact Us</a>
                  <p style="margin:28px 0 0;font-size:15px;line-height:1.7">Warm regards,<br><strong>Growvelt Courses Team</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;color:#667085;font-size:12px">Growvelt Technologies Limited</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function adminHtml(registration: Registration) {
  const name = escapeHtml(registration.full_name);
  const email = escapeHtml(registration.email);
  const phone = escapeHtml(registration.phone);
  const course = escapeHtml(registration.course);
  const learningMode = escapeHtml(registration.learning_mode);
  const experienceLevel = escapeHtml(registration.experience_level);
  const message = escapeHtml(registration.message);
  return `
    <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden">
              <tr>
                <td style="padding:24px 28px;background:#2b0648">
                  <img src="${logoUrl}" alt="Growvelt" width="190" style="display:block;max-width:190px;height:auto;margin-bottom:16px">
                  <h1 style="margin:0;color:#ffffff;font-size:23px;line-height:1.3">New course registration</h1>
                  <p style="margin:8px 0 0;color:#e9d7fe;font-size:15px">${course || "Course not specified"}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:28px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                    <tr><td style="padding:10px 0;color:#667085;width:160px">Name</td><td style="padding:10px 0;font-weight:bold">${name}</td></tr>
                    <tr><td style="padding:10px 0;color:#667085">Email</td><td style="padding:10px 0"><a href="mailto:${email}" style="color:#4b0082">${email}</a></td></tr>
                    <tr><td style="padding:10px 0;color:#667085">Phone</td><td style="padding:10px 0">${phone}</td></tr>
                    <tr><td style="padding:10px 0;color:#667085">Course</td><td style="padding:10px 0;font-weight:bold">${course}</td></tr>
                    <tr><td style="padding:10px 0;color:#667085">Learning mode</td><td style="padding:10px 0">${learningMode}</td></tr>
                    <tr><td style="padding:10px 0;color:#667085">Experience level</td><td style="padding:10px 0">${experienceLevel}</td></tr>
                  </table>
                  <div style="margin-top:18px;padding:16px 18px;background:#f9fafb;border:1px solid #e4e7ec;border-radius:10px">
                    <p style="margin:0 0 8px;color:#667085;font-size:13px;font-weight:bold;text-transform:uppercase">Message</p>
                    <p style="margin:0;color:#172033;line-height:1.7">${message || "No message provided."}</p>
                  </div>
                  <div style="margin-top:22px">
                    <a href="mailto:${email}" style="display:inline-block;background:#ff920f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Reply to Applicant</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
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
