import { createClient } from "@/app/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InstructorApplication = {
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  country: string | null;
  phone: string | null;
  years_experience: number | null;
  teaching_experience: string | null;
  motivation: string | null;
  portfolio_url: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

export type InstructorApplicationIdentity = {
  fullName: string | null;
  email: string | null;
};

async function readOwnInstructorApplication(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("instructor_profiles")
    .select("headline,bio,expertise,country,phone,years_experience,teaching_experience,motivation,portfolio_url,approval_status,created_at,reviewed_at")
    .maybeSingle();

  if (error) throw new Error("Unable to load Instructor application status.");
  return data as InstructorApplication | null;
}

export async function getOwnInstructorApplication() {
  return readOwnInstructorApplication(await createClient());
}

export async function getOwnInstructorApplicationContext() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Unable to verify your Growvelt Learning account.");

  const [applicationResult, profileResult] = await Promise.all([
    readOwnInstructorApplication(supabase),
    supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw new Error("Unable to load your Growvelt Learning account details.");

  return {
    application: applicationResult,
    identity: {
      fullName: profileResult.data?.full_name?.trim() || null,
      email: user.email ?? profileResult.data?.email ?? null,
    } satisfies InstructorApplicationIdentity,
  };
}
