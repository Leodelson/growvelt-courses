import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const REFERENCE_PATTERN = /^GS-[A-F0-9]{32}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ code: "not_signed_in" }, { status: 401 });
  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";
  if (!REFERENCE_PATTERN.test(reference)) return NextResponse.json({ code: "invalid_reference" }, { status: 400 });

  const { data, error } = await supabase.rpc("get_own_learning_subscription_payment_status", { p_reference: reference });
  if (error) {
    console.error("subscription.callback_status_failed", { learnerId: user.id, code: error.code });
    return NextResponse.json({ code: "status_unavailable" }, { status: 503 });
  }
  const status = (data as Array<{ invoice_status?: string; subscription_status?: string; access_active?: boolean }> | null)?.[0];
  if (!status) return NextResponse.json({ code: "not_found" }, { status: 404 });
  return NextResponse.json({
    invoiceStatus: status.invoice_status,
    subscriptionStatus: status.subscription_status,
    accessActive: status.access_active === true,
  }, { headers: { "Cache-Control": "no-store" } });
}
