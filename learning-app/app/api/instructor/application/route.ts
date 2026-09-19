import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

type ApplicationBody = { country?: unknown; phone?: unknown; headline?: unknown; expertise?: unknown; yearsExperience?: unknown; teachingExperience?: unknown; bio?: unknown; motivation?: unknown; portfolioUrl?: unknown };
const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("instructor_profiles")
    .select("headline,bio,expertise,country,phone,years_experience,teaching_experience,motivation,portfolio_url,approval_status,created_at,reviewed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("instructor.application_status_api_failed", { userId: user.id, code: error.code });
    return NextResponse.json({ code: "application_status_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ application: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as ApplicationBody | null;
  const country = asText(body?.country), phone = asText(body?.phone), headline = asText(body?.headline), teachingExperience = asText(body?.teachingExperience), bio = asText(body?.bio), motivation = asText(body?.motivation), portfolioUrl = asText(body?.portfolioUrl);
  const expertise = Array.isArray(body?.expertise) ? body.expertise.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 12) : [];
  const yearsExperience = typeof body?.yearsExperience === "number" && Number.isInteger(body.yearsExperience) ? body.yearsExperience : null;
  if (!country || !headline || !teachingExperience || !bio || !motivation || yearsExperience === null || yearsExperience < 0 || yearsExperience > 60 || expertise.length === 0) return NextResponse.json({ code: "invalid_application" }, { status: 400 });
  if (portfolioUrl && !/^https?:\/\/\S+$/i.test(portfolioUrl)) return NextResponse.json({ code: "invalid_application" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("submit_own_instructor_application", { p_country: country, p_phone: phone || null, p_headline: headline, p_expertise: expertise, p_years_experience: yearsExperience, p_teaching_experience: teachingExperience, p_bio: bio, p_motivation: motivation, p_portfolio_url: portfolioUrl || null });
  if (error) { console.error("instructor.application_submit_failed", { userId: user.id, code: error.code }); return NextResponse.json({ code: error.code === "42501" ? "unauthorized" : error.code === "22023" ? "invalid_application" : "application_unavailable" }, { status: error.code === "42501" ? 401 : error.code === "22023" ? 400 : 503 }); }
  return NextResponse.json({ application: (data as unknown[] | null)?.[0] }, { status: 201 });
}
