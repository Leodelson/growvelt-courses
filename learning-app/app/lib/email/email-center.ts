// Shared validation/presentation only. No credentials or recipient database here.
export const senderChoices = [
  { id: "learning", label: "Growvelt", description: "Course news and learning updates.", variable: "LEARNING_FROM_EMAIL" },
  { id: "support", label: "Growvelt Support", description: "Account help and support follow-ups.", variable: "SUPPORT_FROM_EMAIL" },
  { id: "admin", label: "Growvelt Admin", description: "Official account and platform notices.", variable: "ADMIN_FROM_EMAIL" },
  { id: "partnerships", label: "Growvelt Partnerships", description: "Growvelt partnerships and collaborations. partnership@growvelt.com", variable: "PARTNERSHIPS_FROM_EMAIL" },
  { id: "noreply", label: "Growvelt No-reply", description: "Announcements where replies are not expected.", variable: "NOREPLY_FROM_EMAIL" },
] as const;
export const audienceChoices = [
  { id: "all", label: "All Growvelt users", description: "Everyone with recorded Growvelt marketing consent." },
  { id: "learners", label: "Learners", description: "Opted-in learner accounts." },
  { id: "instructors", label: "Approved instructors", description: "Opted-in instructors approved to teach." },
  { id: "organizations", label: "Organizations", description: "Opted-in company owners and administrators." },
  { id: "specific", label: "Selected Growvelt accounts", description: "Match existing Growvelt account emails or IDs." },
] as const;
export type EmailDocument = {
  sender: typeof senderChoices[number]["id"];
  mode: "marketing" | "transactional";
  audience: typeof audienceChoices[number]["id"];
  recipients: string[];
  subject: string;
  headline: string;
  message: string;
  personalized: boolean;
  buttonText: string;
  buttonUrl: string;
  bell: boolean;
};
export const emptyEmailDocument: EmailDocument = { sender:"learning", mode:"marketing", audience:"all", recipients:[], subject:"", headline:"", message:"", personalized:false, buttonText:"", buttonUrl:"", bell:false };
export const emailUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function safeEmailLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ["www.growvelt.com","growvelt.com","learn.growvelt.com","www.learn.growvelt.com","jobs.growvelt.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
export function parseEmailDocument(value: unknown): EmailDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Check the email fields.");
  const input = value as Record<string, unknown>;
  const text = (name: string, min: number, max: number) => {
    const result = typeof input[name] === "string" ? input[name].trim() : "";
    if (result.length < min || result.length > max || result.includes("\0")) throw new Error(`Check ${name}.`);
    return result;
  };
  if (!senderChoices.some(sender => sender.id === input.sender) || !audienceChoices.some(audience => audience.id === input.audience)
    || !["marketing","transactional"].includes(String(input.mode))) throw new Error("Choose a sender, delivery mode and audience.");
  if (typeof input.personalized !== "boolean" || typeof input.bell !== "boolean") throw new Error("Check the greeting and notification options.");
  if (!Array.isArray(input.recipients) || input.recipients.length > 100 || input.recipients.some(item => typeof item !== "string" || item.length > 254)) throw new Error("Use up to 100 existing Growvelt account emails or IDs.");
  const recipients = [...new Set(input.recipients.map(item => item.trim().toLowerCase()).filter(Boolean))];
  if (recipients.some(item => !emailUuid.test(item) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) throw new Error("Check the selected account emails or IDs.");
  if (input.audience === "specific" && !recipients.length) throw new Error("Choose at least one existing Growvelt account.");
  if (input.audience !== "specific" && recipients.length) throw new Error("Selected accounts must use the selected-accounts audience.");
  if (input.mode === "transactional" && (input.audience !== "specific" || recipients.length > 10)) throw new Error("Account/support messages require 1 to 10 selected Growvelt accounts. Promotional messages must remain marketing.");
  const buttonText = text("buttonText",0,60), buttonUrl = text("buttonUrl",0,1000);
  if (!!buttonText !== !!buttonUrl || buttonUrl && !safeEmailLink(buttonUrl)) throw new Error("Add both button fields and use an HTTPS Growvelt link.");
  const subject = text("subject",3,160);
  if (/[\r\n]/.test(subject)) throw new Error("The subject must be one line.");
  return {sender:input.sender as EmailDocument["sender"],mode:input.mode as EmailDocument["mode"],audience:input.audience as EmailDocument["audience"],recipients,subject,headline:text("headline",0,160),message:text("message",10,4000),personalized:input.personalized,buttonText,buttonUrl:buttonUrl ? safeEmailLink(buttonUrl)! : "",bell:input.bell};
}
