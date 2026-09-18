import { NextResponse } from "next/server";
import { recoverInstructorTestPayout } from "@/app/lib/admin/instructor-payout-transfer";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { payoutItemId?: unknown } | null;
  if (!body || !Number.isSafeInteger(body.payoutItemId) || Number(body.payoutItemId) <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try { const result = await recoverInstructorTestPayout(Number(body.payoutItemId), user.id); return NextResponse.json({ status: result.status }); }
  catch { return NextResponse.json({ code: "recovery_unavailable" }, { status: 409 }); }
}
