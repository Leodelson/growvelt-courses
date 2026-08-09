import { createClient } from "@/app/lib/supabase/server";

export type InstructorApplication = {
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

export async function getOwnInstructorApplication() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instructor_profiles")
    .select("headline,bio,expertise,approval_status,created_at,reviewed_at")
    .maybeSingle();

  if (error) throw new Error("Unable to load Instructor application status.");
  return data as InstructorApplication | null;
}
