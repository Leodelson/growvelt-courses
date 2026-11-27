import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request, 1024); }
  catch (error) {
    return NextResponse.json({ code: "invalid_request" }, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!Number.isSafeInteger(body.providerEventId) || Number(body.providerEventId) <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("reprocess_learning_instructor_payout_provider_event", { p_provider_event_id: Number(body.providerEventId), p_actor_user_id: user.id });
  if (error) return NextResponse.json({ code: "reprocess_unavailable" }, { status: 409 });
  return NextResponse.json({ status: (data as Array<{ outcome?: string }> | null)?.[0]?.outcome ?? "processed" });
}
