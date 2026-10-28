import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { emailUuid, parseEmailDocument, senderChoices } from "@/app/lib/email/email-center";
import { isEmailOperator } from "@/app/lib/email/email-center-authorization";
import { renderEmailCenterMessage } from "@/app/lib/email/email-center-render";
import { emailCenterRelease, emailCenterProviderRuntime, checkEmailCenterRecipients } from "@/app/lib/email/email-center-runtime";
import { runLearningBroadcast } from "@/app/lib/email/email-center-broadcast-worker";
import { deliverLearningAccountNotice } from "@/app/lib/email/email-center-account-worker";
import { synchronizeLearningConsent } from "@/app/lib/email/email-center-consent-worker";

const json = (data: unknown, status = 200) => NextResponse.json(data, {status,headers:{"Cache-Control":"private, no-store"}});
async function operatorSession() {
  const client = await createClient();
  const {data:{user},error:authError} = await client.auth.getUser();
  if (authError || !isEmailOperator(user)) return null;
  const {data,error} = await client.rpc("is_growvelt_learning_admin");
  return !error && data === true ? user : null;
}
export async function GET() {
  if (!await operatorSession()) return json({error:"Only the two authorized Growvelt email administrators may use Email Center."},403);
  const admin = createAdminClient();
  const [drafts,legacy,operations,attempts] = await Promise.all([
    admin.from("learning_email_center_drafts").select("id,document,revision,status,created_at,updated_at,reviewed_at").order("updated_at",{ascending:false}).limit(30),
    admin.from("learning_email_campaigns").select("id,subject,status,sent_count,failed_count,created_at").order("created_at",{ascending:false}).limit(10),
    admin.from("learning_email_broadcast_operations").select("draft_id,revision,phase,provider_status,updated_at").order("updated_at",{ascending:false}).limit(30),
    admin.from("learning_email_center_attempts").select("draft_id,target_key,state,checked_at").order("claimed_at",{ascending:false}).limit(100),
  ]);
  if (drafts.error) return json({error:"The Email Center upgrade needs its approved Growvelt database migration. Existing campaigns are preserved.",setupRequired:true},503);
  const release = emailCenterRelease();
  return json({drafts:drafts.data ?? [],legacy:legacy.error ? [] : legacy.data ?? [],
    senders:senderChoices.map(sender=>({id:sender.id,configured:!!process.env[sender.variable]})),
    operations:operations.error ? [] : operations.data ?? [],attempts:attempts.error ? [] : attempts.data ?? [],
    recoveryEnabled:release.enabled || process.env.LEARNING_EMAIL_CENTER_RECOVERY === "enabled",
    deliveryEnabled:release.enabled,releaseMode:release.mode,marketingRecipientLimit:release.maxRecipients,
    deliveryNotice:(release.mode === "admin-live" && release.enabled
      ? `Admin-approved broadcasts allow up to ${release.maxRecipients} opted-in Growvelt accounts. Account/support messages retain their separate short-lived quota approval. `
      : "Only recipients on the approved allowlist can receive messages. ") + "Preparing never sends; final release approval expires after 15 minutes. Unknown outcomes are reconciled, never blindly retried. Bell and push remain separate and disabled.",
  });
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({error:"This request was not accepted."},403);
  const actor = await operatorSession();
  if (!actor) return json({error:"Only the two authorized Growvelt email administrators may use Email Center."},403);
  let input: Record<string,unknown>;
  try { input = await readBoundedJsonObject(request,32*1024); }
  catch (error) { return json({error:"Check the request fields."},error instanceof JsonBodyError ? error.status : 400); }
  // No fallback to the old per-recipient marketing sender.
  if (["send","prepare-broadcast","dispatch-broadcast","reconcile-broadcast","cancel-broadcast","release-review","approve-release","sync-consent"].includes(String(input.action))) {
    const recoveryAction=["reconcile-broadcast","cancel-broadcast"].includes(String(input.action));
    if (!emailCenterRelease().enabled && !(recoveryAction && process.env.LEARNING_EMAIL_CENTER_RECOVERY === "enabled")) return json({error:"Sending is not activated. Complete Growvelt provider and budget verification first. No email was sent."},503);
    const admin = createAdminClient();
    try {
      if (input.action === "sync-consent") {
        if (typeof input.userId !== "string" || !emailUuid.test(input.userId)) return json({error:"Choose a valid Growvelt account."},400);
        const {membership} = emailCenterProviderRuntime();
        return json(await synchronizeLearningConsent({database:admin,provider:membership,userId:input.userId,enabled:true}));
      }
      if (typeof input.id !== "string" || !emailUuid.test(input.id) || !Number.isSafeInteger(input.revision) || Number(input.revision)<1) return json({error:"Choose a saved review."},400);
      // Reconciliation and cancellation must still work after a user's opt-out
      // or identity change. Never gate those safety operations on current consent.
      if (["reconcile-broadcast","cancel-broadcast"].includes(String(input.action))) {
        const runtime = emailCenterProviderRuntime({recoveryOnly:true});
        return json(await runLearningBroadcast({database:admin,...runtime,actorId:actor.id,draftId:input.id,revision:Number(input.revision),enabled:true},input.action === "cancel-broadcast" ? "cancel" : "reconcile"));
      }
      const review = await checkEmailCenterRecipients(admin,actor.id,input.id,Number(input.revision));
      if (input.action === "release-review") return json({targets:review.targets,subject:review.document.subject,sender:emailCenterProviderRuntime().transport.senderIdentity(parseEmailDocument(review.document).sender),mode:review.document.mode});
      if (input.action === "approve-release") {
        if (!Array.isArray(input.recipients) || input.recipients.length>emailCenterRelease().maxRecipients || input.recipients.some(value=>typeof value!=="string")) return json({error:"Confirm the reviewed addresses."},400);
        const approval = await admin.rpc("approve_learning_email_release",{p_actor:actor.id,p_id:input.id,p_revision:input.revision,p_recipients:input.recipients});
        if (approval.error) return json({error:"Release approval failed. Review recipients again."},409);
        return json({state:"approved",notice:"This exact revision and recipient list are approved for 15 minutes. Nothing was sent."});
      }
      const runtime = emailCenterProviderRuntime();
      if (input.action === "prepare-broadcast" || input.action === "dispatch-broadcast") return json(await runLearningBroadcast({database:admin,...runtime,actorId:actor.id,draftId:input.id,revision:Number(input.revision),enabled:true},input.action === "prepare-broadcast" ? "prepare" : "dispatch"));
      if (typeof input.targetUserId !== "string" || !emailUuid.test(input.targetUserId)) return json({error:"Choose a reviewed recipient."},400);
      const approval = await admin.rpc("check_learning_email_release",{p_actor:actor.id,p_id:input.id,p_revision:input.revision});
      if (approval.error || approval.data!==true) return json({error:"An unexpired exact release approval is required."},409);
      return json(await deliverLearningAccountNotice({database:admin,transport:runtime.transport,actorId:actor.id,draftId:input.id,revision:Number(input.revision),targetUserId:input.targetUserId,enabled:true}));
    } catch (error) {
      return json({error:error instanceof Error ? error.message : "This operation needs review. Do not resend."},503);
    }
  }
  if (["preview","save"].includes(String(input.action))) {
    let document;
    try { document = parseEmailDocument(input.document); }
    catch (error) { return json({error:error instanceof Error ? error.message : "Check the email fields."},400); }
    if (input.action === "preview") return json({html:renderEmailCenterMessage(document,document.personalized ? "Alex" : "there"),exampleName:document.personalized,subject:document.subject});
    if (typeof input.id !== "string" || !emailUuid.test(input.id) || !Number.isSafeInteger(input.revision) || Number(input.revision)<0) return json({error:"Check the draft ID and revision."},400);
    const {data,error} = await createAdminClient().rpc("save_learning_email_center_draft",{p_actor:actor.id,p_id:input.id,p_revision:input.revision,p_document:document});
    if (error) return json({error:["PT409","40001"].includes(error.code) ? "This draft changed. Reload it before saving." : "Draft could not be saved. Keep your text and try again."},["PT409","40001"].includes(error.code) ? 409 : 503);
    return json(data,201);
  }
  if (input.action === "review") {
    if (typeof input.id !== "string" || !emailUuid.test(input.id) || !Number.isSafeInteger(input.revision) || Number(input.revision)<1) return json({error:"Save a draft before reviewing."},400);
    const {data,error} = await createAdminClient().rpc("review_learning_email_center_draft",{p_actor:actor.id,p_id:input.id,p_revision:input.revision});
    if (error) return json({error:["PT409","40001"].includes(error.code) ? "This draft changed. Reload and review again." : error.code === "22023" ? "No eligible recipients, unknown selected accounts, or recipient limit exceeded. Marketing requires explicit marketing opt-in." : "Recipients could not be checked. No messages were sent."},["PT409","40001"].includes(error.code) ? 409 : error.code === "22023" ? 400 : 503);
    return json(data);
  }
  return json({error:"Choose preview, save or review. Legacy sending is disabled."},400);
}
