import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request, 4 * 1024); }
  catch (error) { return NextResponse.json({ code: "invalid_organization" }, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 100) {
    return NextResponse.json({ code: "invalid_organization" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("create_own_learning_provider_organization", { p_name: name, p_slug: slug });
  if (error) {
    console.error("Organization creation failed", { code: error.code });
    if (error.code === "23505") return NextResponse.json({ code: "organization_slug_taken" }, { status: 409 });
    if (error.code === "P0001") return NextResponse.json({ code: "provider_workspace_exists" }, { status: 409 });
    if (error.code === "42501") return NextResponse.json({ code: "approved_instructor_required" }, { status: 403 });
    return NextResponse.json({ code: "organization_unavailable" }, { status: 500 });
  }
  return NextResponse.json({ organization: (data as unknown[] | null)?.[0] }, { status: 201 });
}
