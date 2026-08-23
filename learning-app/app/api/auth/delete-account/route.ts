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

  const body = await request.json().catch(() => null) as { certificateChoice?: unknown; reasons?: unknown; detail?: unknown } | null;
  const certificateChoice = body?.certificateChoice;
  if (certificateChoice !== "keep_verifiable" && certificateChoice !== "remove_public_verification") {
    return NextResponse.json({ code: "certificate_choice_required", message: "Choose how earned certificates should be handled." }, { status: 400 });
  }

  const { data: deletionState, error: deletionStateError } = await supabase.rpc("request_own_learning_account_deletion", {
    p_certificate_choice: certificateChoice,
  });
  if (deletionStateError || !deletionState?.[0]) {
    console.error("Growvelt Learning account deletion preflight failed.", { message: deletionStateError?.message });
    return NextResponse.json({ code: "delete_failed", message: "Account deletion could not be prepared." }, { status: 500 });
  }

  const outcome = deletionState[0].outcome as string;
  if (outcome === "admin_offboarding_required") {
    return NextResponse.json({ code: outcome, message: "Active administrators require managed offboarding." }, { status: 409 });
  }
  if (outcome === "instructor_offboarding_required") {
    return NextResponse.json({ code: outcome, message: "Instructors with course content require managed offboarding." }, { status: 409 });
  }
  if (outcome !== "ready") return NextResponse.json({ code: "delete_failed", message: "Account deletion could not be prepared." }, { status: 500 });

  const admin = createAdminClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_storage_path,cover_storage_path")
    .eq("id", user.id)
    .maybeSingle();
  await admin.from("learning_audit_events").insert({
    actor_user_id: user.id,
    actor_role: "authenticated",
    action: "account.deletion_requested",
    entity_type: "account",
    entity_id: user.id,
    metadata: { source: "self_service", certificate_choice: certificateChoice },
  }).then(({ error: auditError }) => {
    if (auditError) console.error("Growvelt Learning account deletion audit failed.", { message: auditError.message });
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Growvelt Learning account deletion failed.", { message: error.message });
    return NextResponse.json({ code: "delete_failed", message: "Account deletion could not be completed." }, { status: 500 });
  }

  const profilePaths = [profile?.avatar_storage_path, profile?.cover_storage_path]
    .filter((path): path is string => typeof path === "string" && path.startsWith(`${user.id}/`));
  if (profilePaths.length) {
    const { error: mediaError } = await admin.storage.from("learning-profile-media").remove(profilePaths);
    if (mediaError) console.error("Growvelt Learning deleted the account but could not remove all profile media.", { message: mediaError.message });
  }

  return new NextResponse(null, { status: 204 });
}
