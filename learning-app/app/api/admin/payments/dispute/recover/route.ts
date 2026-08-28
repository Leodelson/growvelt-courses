import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { verifyPaystackTestDispute } from "@/app/lib/payments/paystack";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({code:"unauthorized"},{status:401});
  const {data:isAdmin}=await supabase.rpc("is_growvelt_learning_admin"); if(isAdmin!==true) return NextResponse.json({code:"forbidden"},{status:403});
  const body=await request.json().catch(()=>null) as {caseId?:unknown}|null; const caseId=Number(body?.caseId);
  if(!Number.isSafeInteger(caseId)||caseId<=0) return NextResponse.json({code:"invalid_request"},{status:400});
  try {
    const admin=createAdminClient(); const {data:targets,error:targetError}=await admin.rpc("get_learning_dispute_case_for_recovery",{p_operator_id:user.id,p_case_id:caseId});
    const target=(targets as Array<{provider_case_id:string;order_reference:string;amount_minor:number;currency:string}>|null)?.[0];
    if(targetError||!target) return NextResponse.json({code:"dispute_not_recoverable"},{status:409});
    const verified=await verifyPaystackTestDispute({disputeId:target.provider_case_id,transactionReference:target.order_reference});
    const {data:eventId,error:receiveError}=await admin.rpc("receive_paystack_test_verified_dispute",{p_case_id:caseId,p_provider_status:verified.status,p_resolution:verified.resolution,p_amount_minor:verified.amountMinor,p_currency:verified.currency,p_domain:verified.domain,p_category:verified.category,p_reason:verified.reason,p_deadline:verified.deadline,p_payload:verified.payload,p_operator_id:user.id});
    if(receiveError) throw receiveError;
    const {data,error}=await admin.rpc("process_paystack_test_dispute_event",{p_event_id:Number(eventId)}); if(error) throw error;
    return NextResponse.json({outcome:(data as Array<{outcome?:string}>|null)?.[0]?.outcome??verified.status});
  } catch(error) {
    console.error("dispute.operator_recovery_failed",{provider:"paystack",caseId,operatorId:user.id,message:error instanceof Error?error.message:"Unknown error"});
    return NextResponse.json({code:"recovery_failed",message:"The dispute could not be verified safely."},{status:502});
  }
}
