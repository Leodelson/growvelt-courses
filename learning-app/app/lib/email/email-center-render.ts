import "server-only";
import { renderGrowveltEmail } from "./growvelt-email-template";
import { learningAbsoluteUrl } from "../site-urls.mjs";
import type { EmailDocument } from "./email-center";

export function renderEmailCenterMessage(document: EmailDocument, firstName = "there", unsubscribeUrl?: string) {
  return renderGrowveltEmail({baseUrl:learningAbsoluteUrl("/"),greeting:document.personalized ? firstName : "there",title:document.headline || document.subject,
    paragraphs:[],messageMarkdown:document.message,
    ...(document.buttonText ? {primaryAction:{label:document.buttonText,href:document.buttonUrl}} : {}),
    reason:document.mode === "marketing" ? "You received this because you opted in to Growvelt Learning updates." : "This message concerns your Growvelt Learning account or support request.",
    ...(document.mode === "marketing" ? {unsubscribeUrl:unsubscribeUrl || "{{{RESEND_UNSUBSCRIBE_URL}}}"} : {}),
  });
}
