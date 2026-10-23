import "server-only";
import { renderGrowveltEmail } from "./growvelt-email-template";
import { renderLegacyEmailCenterMessage } from "./email-center-legacy";
import { learningAbsoluteUrl } from "../site-urls.mjs";
import type { EmailDocument } from "./email-center";

export function renderEmailCenterMessage(document: EmailDocument, firstName = "there", unsubscribeUrl?: string, legacyForComparison = false) {
  if (legacyForComparison) return renderLegacyEmailCenterMessage(document,firstName,unsubscribeUrl);
  return renderGrowveltEmail({baseUrl:learningAbsoluteUrl("/"),greeting:document.personalized ? firstName : "there",title:document.headline,
    paragraphs:[],messageMarkdown:document.message,
    ...(document.buttonText ? {primaryAction:{label:document.buttonText,href:document.buttonUrl}} : {}),
    reason:document.mode === "marketing" ? "You received this because you opted in to Growvelt updates." : "This message concerns your Growvelt account or support request.",
    ...(document.mode === "marketing" ? {unsubscribeUrl:unsubscribeUrl || "{{{RESEND_UNSUBSCRIBE_URL}}}"} : {}),
  });
}
