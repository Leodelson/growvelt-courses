import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { name?: unknown; slug?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 100) return NextResponse.json({ code: "invalid_company_workspace" }, { status: 400 });
  const supabase = await createClient();
  if (!(await supabase.auth.getUser()).data.user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("create_own_learning_company_workspace", { p_name: name, p_slug: slug });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ code: "company_slug_taken" }, { status: 409 });
    if (error.code === "P0001") return NextResponse.json({ code: "company_workspace_exists" }, { status: 409 });
    if (error.code === "42501") return NextResponse.json({ code: "unauthorized" }, { status: 401 });
    return NextResponse.json({ code: "company_workspace_unavailable" }, { status: 500 });
  }
  return NextResponse.json({ workspace: (data as unknown[] | null)?.[0] }, { status: 201 });
}
