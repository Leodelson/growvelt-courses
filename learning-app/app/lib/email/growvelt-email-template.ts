import "server-only";
import { learningAbsoluteUrl } from "../site-urls.mjs";

type EmailAction = { label: string; href: string };

export type GrowveltEmail = {
  baseUrl: string;
  greeting: string;
  title: string;
  paragraphs: string[];
  primaryAction?: EmailAction;
  secondaryAction?: EmailAction;
  highlights?: string[];
  reason: string;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function actionHtml(action: EmailAction, primary = false) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px"><tr><td style="border-radius:8px;${primary ? "background:#b60d93" : ""}"><a href="${escapeEmailHtml(action.href)}" style="display:inline-block;padding:${primary ? "14px 23px" : "0"};color:${primary ? "#ffffff" : "#f0a3de"};font-size:15px;font-weight:700;text-decoration:none">${escapeEmailHtml(action.label)}${primary ? "&nbsp; →" : " →"}</a></td></tr></table>`;
}

export function renderGrowveltEmail(input: GrowveltEmail) {
  const logoUrl = learningAbsoluteUrl("/logo/growvelt-magenta-email.png");
  const paragraphHtml = input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#e5e7eb">${escapeEmailHtml(paragraph)}</p>`).join("");
  const highlightsHtml = input.highlights?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;background:#252a35;border:1px solid #353b47;border-radius:8px"><tr><td style="padding:18px"><p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#f5f6fa">What happens next</p><ul style="margin:0;padding-left:20px;color:#e5e7eb;font-size:14px;line-height:1.75">${input.highlights.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul></td></tr></table>` : "";
  const year = new Date().getFullYear();

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#11151d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#11151d"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#1c2029;border:1px solid #353b47;border-radius:12px;overflow:hidden"><tr><td align="center" style="padding:27px 30px;background:#ffffff;border-bottom:1px solid #e8e9ef;border-radius:12px 12px 0 0"><img src="${escapeEmailHtml(logoUrl)}" width="124" alt="Growvelt" style="display:block;width:124px;max-width:100%;height:auto;margin:0 auto;border:0" /></td></tr><tr><td style="padding:30px 24px 34px"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#e5e7eb">Hello ${escapeEmailHtml(input.greeting)},</p><h1 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:#f5f6fa;font-weight:700">${escapeEmailHtml(input.title)}</h1>${paragraphHtml}${input.primaryAction ? `<div style="padding-top:6px">${actionHtml(input.primaryAction, true)}</div>` : ""}${input.secondaryAction ? actionHtml(input.secondaryAction) : ""}${highlightsHtml}<div style="height:1px;margin:28px 0 20px;background:#353b47"></div><p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#bac1ce">Need help? <a href="mailto:support@growvelt.com" style="color:#f0a3de">Contact us</a></p><p style="margin:0 0 12px;font-size:12px;line-height:1.65;color:#bac1ce">${escapeEmailHtml(input.reason)}</p><p style="margin:0 0 12px;font-size:12px;line-height:1.65"><a href="${escapeEmailHtml(learningAbsoluteUrl("/about"))}" style="color:#f0a3de">About</a> · <a href="${escapeEmailHtml(learningAbsoluteUrl("/contact"))}" style="color:#f0a3de">Contact</a> · <a href="${escapeEmailHtml(learningAbsoluteUrl("/terms-of-service"))}" style="color:#f0a3de">Terms</a> · <a href="${escapeEmailHtml(learningAbsoluteUrl("/privacy-policy"))}" style="color:#f0a3de">Privacy</a></p><p style="margin:0;font-size:12px;line-height:1.65;color:#bac1ce">Follow us: <a href="https://www.linkedin.com/company/growvelt" style="color:#f0a3de">LinkedIn</a> · <a href="https://web.facebook.com/growvelttechnologies09" style="color:#f0a3de">Facebook</a> · <a href="https://www.instagram.com/growvelt" style="color:#f0a3de">Instagram</a><br />© ${year} Growvelt Technologies Limited (RC - 8738218). All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}
