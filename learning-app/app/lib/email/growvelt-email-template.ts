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

const colors = {
  outer: "#17181b",
  surface: "#202124",
  panel: "#292a2e",
  divider: "#3c4043",
  heading: "#f5f6fa",
  text: "#e5e7eb",
  muted: "#c4c7cc",
  link: "#d7b7ff",
  action: "#9900d5",
} as const;

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function actionHtml(action: EmailAction, primary = false) {
  const background = primary ? ` bgcolor="${colors.action}" style="border-radius:8px;background:${colors.action};background-image:linear-gradient(${colors.action},${colors.action})"` : "";
  const buttonStyle = primary
    ? `display:inline-block;padding:14px 23px;color:#ffffff;-webkit-text-fill-color:#ffffff;font-size:15px;font-weight:700;text-decoration:none`
    : `display:inline-block;color:${colors.link};-webkit-text-fill-color:${colors.link};font-size:15px;font-weight:700;text-decoration:none`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px"><tr><td${background}><a href="${escapeEmailHtml(action.href)}" style="${buttonStyle}">${escapeEmailHtml(action.label)}${primary ? "&nbsp; →" : " →"}</a></td></tr></table>`;
}

export function renderGrowveltEmail(input: GrowveltEmail) {
  const logoUrl = learningAbsoluteUrl("/logo/growvelt-wordmark-purple-20261019.png");
  const paragraphHtml = input.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:${colors.text};-webkit-text-fill-color:${colors.text}">${escapeEmailHtml(paragraph)}</p>`).join("");
  const highlightsHtml = input.highlights?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.panel}" style="margin:24px 0 0;background:${colors.panel};background-image:linear-gradient(${colors.panel},${colors.panel});border:1px solid ${colors.divider};border-radius:8px"><tr><td style="padding:18px"><p style="margin:0 0 10px;font-size:15px;font-weight:700;color:${colors.heading};-webkit-text-fill-color:${colors.heading}">What happens next</p><ul style="margin:0;padding-left:20px;color:${colors.text};-webkit-text-fill-color:${colors.text};font-size:14px;line-height:1.75">${input.highlights.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul></td></tr></table>` : "";
  const year = new Date().getFullYear();
  const aboutUrl = escapeEmailHtml(learningAbsoluteUrl("/about"));
  const contactUrl = escapeEmailHtml(learningAbsoluteUrl("/contact"));
  const termsUrl = escapeEmailHtml(learningAbsoluteUrl("/terms-of-service"));
  const privacyUrl = escapeEmailHtml(learningAbsoluteUrl("/privacy-policy"));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><style>:root{color-scheme:dark;supported-color-schemes:dark}</style></head><body bgcolor="${colors.outer}" style="margin:0;padding:0;background:${colors.outer};background-image:linear-gradient(${colors.outer},${colors.outer});font-family:Arial,Helvetica,sans-serif;color:${colors.text};-webkit-text-fill-color:${colors.text}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.outer}" style="background:${colors.outer};background-image:linear-gradient(${colors.outer},${colors.outer})"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.surface}" style="max-width:640px;background:${colors.surface};background-image:linear-gradient(${colors.surface},${colors.surface});border:1px solid ${colors.divider};border-radius:12px;overflow:hidden"><tr><td align="center" bgcolor="${colors.surface}" style="padding:27px 30px;background:${colors.surface};background-image:linear-gradient(${colors.surface},${colors.surface});border-bottom:1px solid ${colors.divider};border-radius:12px 12px 0 0"><img src="${escapeEmailHtml(logoUrl)}" width="116" alt="Growvelt" style="display:block;width:116px;max-width:100%;height:auto;margin:0 auto;border:0" /></td></tr><tr><td bgcolor="${colors.surface}" style="padding:30px 24px 34px;background:${colors.surface};background-image:linear-gradient(${colors.surface},${colors.surface})"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${colors.text};-webkit-text-fill-color:${colors.text}">Hello ${escapeEmailHtml(input.greeting)},</p><h1 style="margin:0 0 16px;font-size:30px;line-height:1.2;color:${colors.heading};-webkit-text-fill-color:${colors.heading};font-weight:700">${escapeEmailHtml(input.title)}</h1>${paragraphHtml}${input.primaryAction ? `<div style="padding-top:6px">${actionHtml(input.primaryAction, true)}</div>` : ""}${input.secondaryAction ? actionHtml(input.secondaryAction) : ""}${highlightsHtml}<div style="height:1px;margin:28px 0 20px;background:${colors.divider}"></div><p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:${colors.muted};-webkit-text-fill-color:${colors.muted}">Need help? <a href="mailto:support@growvelt.com" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Contact us</a></p><p style="margin:0 0 12px;font-size:13px;line-height:1.65;color:${colors.muted};-webkit-text-fill-color:${colors.muted}">${escapeEmailHtml(input.reason)}</p><p style="margin:0 0 12px;font-size:13px;line-height:1.65"><a href="${aboutUrl}" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">About</a> · <a href="${contactUrl}" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Contact</a> · <a href="${termsUrl}" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Terms</a> · <a href="${privacyUrl}" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Privacy</a></p><p style="margin:0;font-size:13px;line-height:1.65;color:${colors.muted};-webkit-text-fill-color:${colors.muted}">Follow us: <a href="https://www.linkedin.com/company/growvelt" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">LinkedIn</a> · <a href="https://web.facebook.com/growvelttechnologies09" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Facebook</a> · <a href="https://www.instagram.com/growvelt" style="color:${colors.link};-webkit-text-fill-color:${colors.link}">Instagram</a><br />© ${year} Growvelt Technologies Limited (RC - 8738218). All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}
