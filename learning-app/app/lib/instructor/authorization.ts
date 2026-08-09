import { createClient } from "@/app/lib/supabase/server";

export async function isApprovedInstructor() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_approved_growvelt_instructor");
  return !error && data === true;
}
