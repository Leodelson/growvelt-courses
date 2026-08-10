import { createClient } from "@/app/lib/supabase/server";
import { cache } from "react";

export const isApprovedInstructor = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_approved_growvelt_instructor");
  return !error && data === true;
});
