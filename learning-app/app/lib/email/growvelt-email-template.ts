import "server-only";

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
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px"><tr><td style="border-radius:8px;${primary ? "background:#bc6bea" : ""}"><a href="${escapeEmailHtml(action.href)}" style="display:inline-block;padding:${primary ? "14px 23px" : "0"};color:${primary ? "#24172b" : "#d69aff"};font-size:15px;font-weight:700;text-decoration:none">${escapeEmailHtml(action.label)}${primary ? "&nbsp; →" : " →"}</a></td></tr></table>`;
}

export function renderGrowveltEmail(input: GrowveltEmail) {
  const logoUrl = new URL("/logo/growvelt-logo-white-text.png", input.baseUrl).href;
  const paragraphHtml = input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#ece8f0">${escapeEmailHtml(paragraph)}</p>`).join("");
  const highlightsHtml = input.highlights?.length ? `<p style="margin:25px 0 10px;font-size:15px;font-weight:700;color:#ffffff">What happens next</p><ul style="margin:0;padding-left:20px;color:#ded8e4;font-size:14px;line-height:1.75">${input.highlights.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul>` : "";
  const year = new Date().getFullYear();

  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#191a1e;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#191a1e"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#202126;border:1px solid #30323a;border-radius:12px;overflow:hidden"><tr><td align="center" style="padding:0;background:#e7b8f3;border-bottom:3px solid #f088b7;border-radius:12px 12px 0 0"><img src="${escapeEmailHtml(logoUrl)}" width="180" alt="Growvelt" style="display:block;width:180px;max-width:100%;height:auto;border:0" /></td></tr><tr><td style="padding:30px 32px 34px"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#f7f4fa">Hello ${escapeEmailHtml(input.greeting)},</p><h1 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:#ffffff;font-weight:700">${escapeEmailHtml(input.title)}</h1>${paragraphHtml}${input.primaryAction ? `<div style="padding-top:6px">${actionHtml(input.primaryAction, true)}</div>` : ""}${input.secondaryAction ? actionHtml(input.secondaryAction) : ""}${highlightsHtml}<div style="height:1px;margin:28px 0 20px;background:#3a3c44"></div><p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#bcb6c5">Need help? <a href="mailto:support@growvelt.com" style="color:#d69aff">Contact us</a></p><p style="margin:0;font-size:12px;line-height:1.65;color:#96909e">${escapeEmailHtml(input.reason)}<br /><br />Follow us: <a href="https://www.linkedin.com/company/growvelt" style="color:#cba0dd">LinkedIn</a> · <a href="https://www.facebook.com/growvelt" style="color:#cba0dd">Facebook</a> · <a href="https://www.instagram.com/growvelt" style="color:#cba0dd">Instagram</a><br />© ${year} Growvelt Technologies Limited (RC - 8738218). All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}
