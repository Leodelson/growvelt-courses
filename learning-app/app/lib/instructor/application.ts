import { createClient } from "@/app/lib/supabase/server";

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

async function readOwnInstructorApplication() {
  const { data, error } = await (await createClient()).rpc("get_own_instructor_application").maybeSingle();

  if (error) throw new Error("Unable to load Instructor application status.");
  return data as InstructorApplication | null;
}

export async function getOwnInstructorApplication() {
  return readOwnInstructorApplication();
}

export async function getOwnInstructorApplicationContext() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Unable to verify your Growvelt Learning account.");

  const [applicationResult, profileResult] = await Promise.all([
    readOwnInstructorApplication(),
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
