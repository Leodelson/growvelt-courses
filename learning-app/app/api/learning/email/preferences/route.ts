import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const body = await request.json().catch(() => null) as { marketingOptIn?: unknown } | null;
  if (typeof body?.marketingOptIn !== "boolean") return new NextResponse(null, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("learning_email_preferences").upsert({ user_id: user.id, marketing_opt_in: body.marketingOptIn, changed_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Your preference could not be saved." }, { status: 503 });
  return NextResponse.json({ marketingOptIn: body.marketingOptIn }, { headers: { "Cache-Control": "no-store" } });
}
