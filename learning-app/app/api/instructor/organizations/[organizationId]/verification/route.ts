import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const organizationId = Number((await params).organizationId);
  const body = await request.json().catch(() => null) as { legalName?: unknown; contactEmail?: unknown; websiteUrl?: unknown; statement?: unknown } | null;
  const legalName = typeof body?.legalName === "string" ? body.legalName.trim() : "";
  const contactEmail = typeof body?.contactEmail === "string" ? body.contactEmail.trim() : "";
  const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const statement = typeof body?.statement === "string" ? body.statement.trim() : "";
  if (!Number.isSafeInteger(organizationId) || organizationId < 1 || legalName.length < 2 || legalName.length > 160 || contactEmail.length > 320 || websiteUrl.length > 400 || statement.length < 30 || statement.length > 2000) return NextResponse.json({ code: "invalid_verification" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("submit_own_learning_provider_organization_verification", { p_organization_id: organizationId, p_legal_name: legalName, p_contact_email: contactEmail, p_website_url: websiteUrl || null, p_verification_statement: statement });
  if (error) return NextResponse.json({ code: error.code === "42501" ? "owner_required" : error.code === "P0001" ? "verification_unavailable" : error.code === "22023" ? "invalid_verification" : "verification_unavailable" }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409 });
  return NextResponse.json({ verification: (data as unknown[] | null)?.[0] ?? null }, { status: 201 });
}
