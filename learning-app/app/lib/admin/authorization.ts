import { createClient } from "@/app/lib/supabase/server";

export async function isLearningAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_growvelt_learning_admin");
  return !error && data === true;
}
