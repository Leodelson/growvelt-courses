import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin", message: "This request was not accepted." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) return NextResponse.json({ code: "not_configured", message: "Account deletion is not configured." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_signed_in", message: "Sign in again to delete your account." }, { status: 401 });

  const admin = createAdminClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await admin.from("learning_audit_events").insert({
    actor_user_id: user.id,
    actor_role: "authenticated",
    action: "account.deletion_requested",
    entity_type: "account",
    entity_id: user.id,
    metadata: { source: "self_service" },
  }).then(({ error: auditError }) => {
    if (auditError) console.error("Growvelt Learning account deletion audit failed.", { message: auditError.message });
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Growvelt Learning account deletion failed.", { message: error.message });
    return NextResponse.json({ code: "delete_failed", message: "Account deletion could not be completed." }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
