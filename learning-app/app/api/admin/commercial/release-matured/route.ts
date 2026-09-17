import { NextResponse } from "next/server";
import { runMaturedInstructorEarningsRelease } from "@/app/lib/admin/instructor-earnings-release";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try {
    const { releasedCount } = await runMaturedInstructorEarningsRelease("admin_recovery", user.id);
    return NextResponse.json({ status: "completed", releasedCount });
  } catch {
    return NextResponse.json({ code: "release_unavailable" }, { status: 503 });
  }
}
