import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

const mediaPattern = /^(logo|cover)$/;
const pathPattern = /^[1-9][0-9]*\/(?:logos|covers)\/[0-9a-f-]+\.(?:jpg|png|webp)$/;

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const organizationId = Number((await params).organizationId);
  const body = await request.json().catch(() => null) as { kind?: unknown; storagePath?: unknown } | null;
  const kind = typeof body?.kind === "string" ? body.kind : "";
  const storagePath = typeof body?.storagePath === "string" ? body.storagePath.trim() : "";
  if (!Number.isSafeInteger(organizationId) || organizationId < 1 || !mediaPattern.test(kind) || !pathPattern.test(storagePath)) return NextResponse.json({ code: "invalid_media" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("update_own_learning_provider_organization_profile_media", { p_organization_id: organizationId, p_media_kind: kind, p_storage_path: storagePath });
  if (error) return NextResponse.json({ code: error.code === "42501" ? "owner_required" : error.code === "22023" ? "invalid_media" : "media_unavailable" }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409 });
  return NextResponse.json({ profile: (data as unknown[] | null)?.[0] ?? null }, { status: 201 });
}
