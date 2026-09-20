import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });

  const organizationId = Number((await params).organizationId);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const value = (key: string) => typeof body?.[key] === "string" ? body[key].trim() : "";
  const headline = value("headline");
  const description = value("description");
  const contactEmail = value("contactEmail");
  const websiteUrl = value("websiteUrl");
  const linkedinUrl = value("linkedinUrl");
  const instagramUrl = value("instagramUrl");

  if (!Number.isSafeInteger(organizationId) || organizationId < 1 || headline.length < 8 || headline.length > 160 || description.length < 80 || description.length > 2400 || contactEmail.length < 5 || contactEmail.length > 320 || websiteUrl.length > 400 || linkedinUrl.length > 400 || instagramUrl.length > 400) {
    return NextResponse.json({ code: "invalid_profile" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("update_own_learning_provider_organization_profile", {
    p_organization_id: organizationId,
    p_headline: headline,
    p_description: description,
    p_contact_email: contactEmail,
    p_website_url: websiteUrl || null,
    p_linkedin_url: linkedinUrl || null,
    p_instagram_url: instagramUrl || null,
  });
  if (error) {
    const code = error.code === "42501" ? "verified_owner_required" : error.code === "22023" ? "invalid_profile" : "profile_unavailable";
    return NextResponse.json({ code }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409 });
  }
  return NextResponse.json({ profile: (data as unknown[] | null)?.[0] ?? null }, { status: 201 });
}
