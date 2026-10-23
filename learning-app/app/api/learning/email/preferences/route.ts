import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const { data: { user }, error: authError } = await (await createClient()).auth.getUser();
  if (authError || !user?.email_confirmed_at) return new NextResponse(null, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request, 1024); }
  catch (error) { return new NextResponse(null, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  if (typeof body?.marketingOptIn !== "boolean") return new NextResponse(null, { status: 400 });
  const admin = createAdminClient();
  // Consent, audit event and desired provider state commit together. Never
  // fall back to a direct update if the approved migration is missing.
  const { error } = await admin.rpc("set_learning_email_preference", { p_user_id: user.id, p_opt_in: body.marketingOptIn, p_source: "settings" });
  if (error) return NextResponse.json({ error: "Your preference could not be saved." }, { status: 503 });
  return NextResponse.json({ marketingOptIn: body.marketingOptIn }, { headers: { "Cache-Control": "no-store" } });
}
