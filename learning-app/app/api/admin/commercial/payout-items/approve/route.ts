import { NextResponse } from "next/server";
import { approveInstructorTestPayout } from "@/app/lib/admin/instructor-payout-transfer";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { reservationId?: unknown } | null;
  if (!body || !Number.isSafeInteger(body.reservationId) || Number(body.reservationId) <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try { const item = await approveInstructorTestPayout(Number(body.reservationId), user.id); return NextResponse.json({ status: item.status, payoutItemId: item.payout_item_id }); }
  catch { return NextResponse.json({ code: "approval_unavailable" }, { status: 409 }); }
}
