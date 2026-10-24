import "server-only";
import {after} from "next/server";
import {createAdminClient} from "../supabase/admin";
import {readEmailCenterProviderUsage} from "./email-center-provider-usage";
import {runAdminSubmissionAlerts} from "./admin-submission-worker";

export async function drainAdminSubmissionAlerts(){
  const enabled=process.env.LEARNING_ADMIN_ALERTS_ENABLED==="enabled";
  const dailyLimit=Number(process.env.LEARNING_ADMIN_ALERT_DAILY_LIMIT);
  if(!enabled||![10,20].includes(dailyLimit))return{state:"disabled",accepted:0};
  const key=process.env.RESEND_API_KEY,usageKey=process.env.RESEND_MARKETING_API_KEY;
  if(!key||!usageKey||process.env.ADMIN_FROM_EMAIL!=="admin@growvelt.com")return{state:"configuration_pending",accepted:0};
  return runAdminSubmissionAlerts({database:createAdminClient(),enabled,dailyLimit,
    usage:()=>readEmailCenterProviderUsage({key:usageKey,request:fetch}),
    send:async({to,subject,html,key:operation})=>{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":operation},
        body:JSON.stringify({from:"Growvelt Admin <admin@growvelt.com>",to:[to],reply_to:"support@growvelt.com",subject,html,tags:[{name:"product",value:"learning"},{name:"category",value:"admin_submission"}]})});
      if(!response.ok){await response.body?.cancel().catch(()=>undefined);throw new Error("Provider outcome requires review");}
      const data=await response.json();if(typeof data?.id!=="string")throw new Error("Provider outcome requires review");return{id:data.id};
    }});
}
export function scheduleAdminSubmissionAlerts(){
  if(process.env.LEARNING_ADMIN_ALERTS_ENABLED!=="enabled")return;
  // Submissions are already committed. A scheduling failure must not turn a
  // successful submission into an error response or encourage duplicate forms.
  try {
    after(async()=>{try{await drainAdminSubmissionAlerts();}catch{console.error("admin_submission_alert.delivery_needs_review");}});
  } catch {
    console.error("admin_submission_alert.scheduling_needs_review");
  }
}
