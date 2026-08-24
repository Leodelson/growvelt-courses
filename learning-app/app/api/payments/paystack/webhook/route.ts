import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { digestPaystackPayload, getPaystackTestConfig, parsePaystackTestChargeSuccess, verifyPaystackSignature } from "@/app/lib/payments/paystack";

export async function POST(request: Request) {
  let config; try { config = getPaystackTestConfig(false); } catch { return NextResponse.json({ code: "not_configured" }, { status: 503 }); }
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 262144) return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"), config.secretKey)) return NextResponse.json({ code: "invalid_signature" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ code: "invalid_payload" }, { status: 400 });
  }
  const parsed = parsePaystackTestChargeSuccess(payload);
  if (!parsed) return new NextResponse(null, { status: 204 });
  const { data, error } = await createAdminClient().rpc("finalize_paystack_test_charge", {
    p_provider_event_id: parsed.eventId, p_payload_digest: digestPaystackPayload(rawBody), p_reference: parsed.reference,
    p_provider_transaction_id: parsed.transactionId, p_amount_minor: parsed.amountMinor, p_currency: parsed.currency, p_domain: parsed.domain, p_payload: parsed.payload,
  });
  if (error) { console.error("Growvelt Learning Paystack webhook finalization failed.", { reference: parsed.reference, message: error.message }); return NextResponse.json({ code: "processing_failed" }, { status: 500 }); }
  const outcome = (data as Array<{ outcome?: string }> | null)?.[0]?.outcome;
  if (outcome && !["paid_and_enrolled","already_processed","already_paid"].includes(outcome)) console.error("Growvelt Learning Paystack webhook requires reconciliation.", { reference: parsed.reference, outcome });
  return NextResponse.json({ received: true });
}
