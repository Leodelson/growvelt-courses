import "server-only";
import {randomUUID} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {readAdminSubmission,renderAdminSubmission,type SubmissionAlert} from "./admin-submission-content";
import {hasEmailCenterProviderHeadroom,type EmailCenterProviderUsage} from "./email-center-provider-usage";

export const adminAlertRecipients={owner:"nduleonardc@gmail.com",admin:"admin@growvelt.com"} as const;
type Database=Pick<SupabaseClient,"from"|"rpc">;
type Input={database:Database;enabled:boolean;dailyLimit:number;usage:()=>Promise<EmailCenterProviderUsage>;send:(input:{to:string;subject:string;html:string;key:string})=>Promise<{id:string}>};
export async function runAdminSubmissionAlerts(input:Input){
  if(!input.enabled||![10,20].includes(input.dailyLimit))return{state:"disabled",accepted:0};
  const holder=randomUUID();const lock=await input.database.rpc("acquire_learning_admin_alert_run",{p_holder:holder});
  if(lock.error)throw new Error("Alert lease unavailable");if(lock.data!==true)return{state:"busy",accepted:0};
  let accepted=0;
  const started=Date.now();
  try{
    const result=await input.database.from("learning_admin_submission_deliveries").select("id,alert_id,recipient").eq("state","pending").lte("not_before",new Date().toISOString()).order("not_before").order("id").limit(20);
    if(result.error)throw new Error("Alert queue unavailable");
    for(const delivery of result.data??[]){
      // Leave enough of the 60-second request lifetime for one bounded usage
      // check, provider call and checkpoint. Unclaimed work stays pending.
      if(Date.now()-started>=25000)return{state:"time_budget",accepted};
      if(!Object.hasOwn(adminAlertRecipients,delivery.recipient))throw new Error("Invalid alert recipient");
      const record=await input.database.from("learning_admin_submission_alerts").select("id,kind,source_id,source_version,actor_id,created_at").eq("id",delivery.alert_id).single();
      if(record.error)throw new Error("Alert source unavailable");
      const content=await readAdminSubmission(input.database,record.data as SubmissionAlert);
      if(!content){const checkpoint=await input.database.from("learning_admin_submission_deliveries").update({state:"failed",failure_code:"source_removed"}).eq("id",delivery.id).eq("state","pending");if(checkpoint.error)throw new Error("Alert checkpoint unavailable");continue;}
      // Shared allowance is checked afresh; the local ledger is not a separate
      // provider quota or an atomic reservation against Careers' other mail.
      if(!hasEmailCenterProviderHeadroom(await input.usage()))return{state:"waiting_for_quota",accepted};
      const html=renderAdminSubmission(content);
      if(Buffer.byteLength(html)>90000)throw new Error("Alert content needs review");
      const claim=await input.database.rpc("claim_learning_admin_submission_delivery",{p_id:delivery.id,p_holder:holder,p_daily_limit:input.dailyLimit});
      if(claim.error)throw new Error("Alert claim unavailable");if(claim.data!==true)return{state:"budget_or_claim_blocked",accepted};
      let provider:{id:string};
      try{provider=await input.send({to:adminAlertRecipients[delivery.recipient as keyof typeof adminAlertRecipients],subject:content.title,html,key:`growvelt-admin-submission-${delivery.id}`});}
      catch{const checkpoint=await input.database.from("learning_admin_submission_deliveries").update({state:"uncertain",failure_code:"provider_outcome_unknown"}).eq("id",delivery.id).eq("state","dispatching");if(checkpoint.error)throw new Error("Alert outcome requires review");continue;}
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(provider.id))throw new Error("Provider acceptance requires review");
      const checkpoint=await input.database.from("learning_admin_submission_deliveries").update({state:"accepted",provider_id:provider.id}).eq("id",delivery.id).eq("state","dispatching");
      if(checkpoint.error)throw new Error("Provider accepted; audit checkpoint requires review. Do not resend.");accepted++;
    }
    return{state:"checked",accepted};
  }finally{const release=await input.database.rpc("release_learning_admin_alert_run",{p_holder:holder});if(release.error)console.error("admin_submission_alert.release_failed");}
}
