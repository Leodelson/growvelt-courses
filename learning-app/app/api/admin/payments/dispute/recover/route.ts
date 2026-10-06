import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPaystackConfig, verifyPaystackLiveDispute, verifyPaystackTestDispute } from "@/app/lib/payments/paystack";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({code:"unauthorized"},{status:401});
  const {data:isAdmin}=await supabase.rpc("is_growvelt_learning_admin"); if(isAdmin!==true) return NextResponse.json({code:"forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as {caseId?:unknown}|null; const caseId=Number(body?.caseId);
  if(!Number.isSafeInteger(caseId)||caseId<=0) return NextResponse.json({code:"invalid_request"},{status:400});
  try {
    const mode = getPaystackConfig(false).mode;
    const lookupFunction = mode === "live" ? "get_learning_live_dispute_case_for_recovery" : "get_learning_test_dispute_case_for_recovery";
    const admin=createAdminClient(); const {data:targets,error:targetError}=await admin.rpc(lookupFunction,{p_operator_id:user.id,p_case_id:caseId});
    const target=(targets as Array<{provider_case_id:string;order_reference:string;amount_minor:number;currency:string}>|null)?.[0];
    if(targetError||!target) return NextResponse.json({code:"dispute_not_recoverable"},{status:409});
    const verifyDispute = mode === "live" ? verifyPaystackLiveDispute : verifyPaystackTestDispute;
    const verified=await verifyDispute({disputeId:target.provider_case_id,transactionReference:target.order_reference});
    const receiveFunction = mode === "live" ? "receive_paystack_live_verified_dispute" : "receive_paystack_test_verified_dispute";
    const {data:eventId,error:receiveError}=await admin.rpc(receiveFunction,{p_case_id:caseId,p_provider_status:verified.status,p_resolution:verified.resolution,p_amount_minor:verified.amountMinor,p_currency:verified.currency,p_domain:verified.domain,p_category:verified.category,p_reason:verified.reason,p_deadline:verified.deadline,p_payload:verified.payload,p_operator_id:user.id});
    if(receiveError) throw receiveError;
    const processFunction = mode === "live" ? "recover_paystack_live_dispute_event" : "process_paystack_test_dispute_event";
    const processArgs = mode === "live" ? { p_event_id: Number(eventId), p_operator_id: user.id } : { p_event_id: Number(eventId) };
    const {data,error}=await admin.rpc(processFunction,processArgs); if(error) throw error;
    const outcome=(data as Array<{outcome?:string}>|null)?.[0]?.outcome??verified.status;
    if(outcome==="lost"){const context=await getOrderNotificationContext(target.order_reference);if(context)await sendPaymentNotification({key:`access-revoked:chargeback:provider-api:${eventId}`,type:"access_revoked",recipient:context.email,subject:"Growvelt Learning course access updated",heading:"Course access has ended",message:`Paystack confirmed a financial reversal for ${context.courseTitle}. Future access has ended while historical learning activity remains retained.`,orderId:context.orderId,caseId});}
    return NextResponse.json({outcome});
  } catch(error) {
    console.error("dispute.operator_recovery_failed",{provider:"paystack",caseId,operatorId:user.id,message:error instanceof Error?error.message:"Unknown error"});
    return NextResponse.json({code:"recovery_failed",message:"The dispute could not be verified safely."},{status:502});
  }
}
