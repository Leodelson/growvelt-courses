import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";
import { learningAbsoluteUrl } from "@/app/lib/site-urls.mjs";

type Audience = "learners" | "instructors" | "organizations";
type Recipient = { user_id: string; email: string; unsubscribe_token: string };
type Campaign = { id: string; audience: Audience; subject: string; headline: string; body: string; status: string; sent_count: number; failed_count: number };
const audiences = new Set<Audience>(["learners", "instructors", "organizations"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("is_growvelt_learning_admin");
  return !error && data === true ? user : null;
}

export async function GET() {
  if (!await adminSession()) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const admin = createAdminClient();
  const [campaigns, learners, instructors, organizations] = await Promise.all([
    admin.from("learning_email_campaigns").select("id,audience,subject,headline,body,status,sent_count,failed_count,created_at").order("created_at", { ascending: false }).limit(20),
    admin.rpc("learning_marketing_recipient_count", { p_audience: "learners" }),
    admin.rpc("learning_marketing_recipient_count", { p_audience: "instructors" }),
    admin.rpc("learning_marketing_recipient_count", { p_audience: "organizations" }),
  ]);
  if (campaigns.error || learners.error || instructors.error || organizations.error) return NextResponse.json({ error: "Email Center is unavailable until its database migration is applied." }, { status: 503 });
  return NextResponse.json({ campaigns: campaigns.data, counts: { learners: learners.data, instructors: instructors.data, organizations: organizations.data } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const actor = await adminSession();
  if (!actor) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await readBoundedJsonObject(request, 32 * 1024); }
  catch (error) { return NextResponse.json({ error: "Invalid request." }, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  const admin = createAdminClient();

  if (input.action === "create") {
    const audience = input.audience;
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    const headline = typeof input.headline === "string" ? input.headline.trim() : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!audiences.has(audience as Audience) || subject.length < 3 || subject.length > 160 || headline.length < 3 || headline.length > 160 || body.length < 10 || body.length > 4000) return NextResponse.json({ error: "Check the audience and message fields." }, { status: 400 });
    const { data, error } = await admin.from("learning_email_campaigns").insert({ created_by: actor.id, audience, subject, headline, body }).select("id").single();
    if (error) return NextResponse.json({ error: "Draft could not be saved." }, { status: 503 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (input.action !== "send" || typeof input.campaignId !== "string" || !uuid.test(input.campaignId) || input.confirmation !== "SEND LEARNING EMAILS") return NextResponse.json({ error: "Explicit send confirmation is required." }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email sending is not configured." }, { status: 503 });
  const { data: campaign, error: campaignError } = await admin.from("learning_email_campaigns").select("id,audience,subject,headline,body,status,sent_count,failed_count").eq("id", input.campaignId).single();
  if (campaignError || !campaign || !["draft", "partial", "failed", "sending"].includes(campaign.status)) return NextResponse.json({ error: "This campaign cannot be sent." }, { status: 409 });
  const current = campaign as Campaign;
  const { data, error } = await admin.rpc("learning_marketing_recipients", { p_audience: current.audience, p_campaign_id: current.id, p_limit: 3 });
  if (error) return NextResponse.json({ error: "Recipients could not be checked." }, { status: 503 });
  const recipients = (data ?? []) as Recipient[];
  if (!recipients.length) {
    await admin.from("learning_email_campaigns").update({ status: current.failed_count ? "partial" : "sent", updated_at: new Date().toISOString() }).eq("id", current.id);
    return NextResponse.json({ accepted: 0, failed: 0, remaining: false });
  }

  let accepted = 0; let failed = 0;
  for (const recipient of recipients) {
    const { error: claimError } = await admin.from("learning_email_deliveries").insert({ campaign_id: current.id, user_id: recipient.user_id, state: "claimed" });
    if (claimError) continue; // Unique claim: concurrent requests cannot send twice.
    const { data: preference } = await admin.from("learning_email_preferences").select("marketing_opt_in").eq("user_id", recipient.user_id).single();
    if (preference?.marketing_opt_in !== true) {
      await admin.from("learning_email_deliveries").update({ state: "skipped" }).eq("campaign_id", current.id).eq("user_id", recipient.user_id);
      continue;
    }
    const unsubscribeUrl = learningAbsoluteUrl(`/api/learning/email/unsubscribe?token=${recipient.unsubscribe_token}`);
    const html = renderGrowveltEmail({ baseUrl: learningAbsoluteUrl("/"), greeting: "there", title: current.headline, paragraphs: current.body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean), reason: "You received this because you opted in to Growvelt Learning updates.", unsubscribeUrl });
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `learning-campaign-${current.id}-${recipient.user_id}` }, body: JSON.stringify({ from: "Growvelt <no-reply@growvelt.com>", to: [recipient.email], reply_to: "support@growvelt.com", subject: current.subject, html, text: `${current.headline}\n\n${current.body}\n\nUnsubscribe: ${unsubscribeUrl}`, tags: [{ name: "product", value: "learning" }, { name: "category", value: "marketing" }] }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`provider_${response.status}`);
      const provider = await response.json().catch(() => null) as { id?: string } | null;
      await admin.from("learning_email_deliveries").update({ state: "accepted", provider_message_id: provider?.id ?? null }).eq("campaign_id", current.id).eq("user_id", recipient.user_id);
      accepted++;
    } catch {
      await admin.from("learning_email_deliveries").update({ state: "failed" }).eq("campaign_id", current.id).eq("user_id", recipient.user_id);
      failed++;
    }
  }
  const { count: remainingCount } = await admin.from("learning_email_deliveries").select("user_id", { count: "exact", head: true }).eq("campaign_id", current.id);
  const { count: acceptedCount } = await admin.from("learning_email_deliveries").select("user_id", { count: "exact", head: true }).eq("campaign_id", current.id).eq("state", "accepted");
  const { count: failedCount } = await admin.from("learning_email_deliveries").select("user_id", { count: "exact", head: true }).eq("campaign_id", current.id).eq("state", "failed");
  await admin.from("learning_email_campaigns").update({ status: failed ? "partial" : "sending", sent_count: acceptedCount ?? accepted, failed_count: failedCount ?? failed, updated_at: new Date().toISOString() }).eq("id", current.id);
  return NextResponse.json({ accepted, failed, processed: remainingCount ?? 0, remaining: true, note: "Provider accepted messages; final delivery is not confirmed." }, { headers: { "Cache-Control": "no-store" } });
}
