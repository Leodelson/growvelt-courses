import { createClient } from "@/app/lib/supabase/server";

export type AdminInstructorApplication = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export async function getPendingInstructorApplications() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_pending_instructor_applications");

  if (error) throw new Error("Unable to load Instructor applications.");
  return (data ?? []) as AdminInstructorApplication[];
}

export async function getInstructorApplicationForAdmin(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_instructor_application_for_review", { p_application_user_id: userId })
    .maybeSingle();

  if (error) throw new Error("Unable to load this Instructor application.");
  return data as AdminInstructorApplication | null;
}
