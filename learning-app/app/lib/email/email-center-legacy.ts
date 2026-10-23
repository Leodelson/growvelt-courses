import "server-only";
import { renderGrowveltEmailLegacy } from "./growvelt-email-template";
import { learningAbsoluteUrl } from "../site-urls.mjs";
import type { EmailDocument } from "./email-center";

// Exact pre-branding provider payload, for verification/recovery ONLY. Never
// use it for a new send or change already-approved historical campaign content.
export function renderLegacyEmailCenterMessage(document: EmailDocument, firstName = "there", unsubscribeUrl?: string) {
  return renderGrowveltEmailLegacy({baseUrl:learningAbsoluteUrl("/"),greeting:document.personalized ? firstName : "there",title:document.headline || document.subject,
    paragraphs:[],messageMarkdown:document.message,
    ...(document.buttonText ? {primaryAction:{label:document.buttonText,href:document.buttonUrl}} : {}),
    reason:document.mode === "marketing" ? "You received this because you opted in to Growvelt Learning updates." : "This message concerns your Growvelt Learning account or support request.",
    ...(document.mode === "marketing" ? {unsubscribeUrl:unsubscribeUrl || "{{{RESEND_UNSUBSCRIBE_URL}}}"} : {}),
  });
}

export function legacyEmailCenterSender(sender: EmailDocument["sender"], current: string) {
  return sender === "learning" ? current.replace(/^Growvelt </,"Growvelt Learning <") : current;
}
