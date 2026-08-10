import { createClient } from "@/app/lib/supabase/server";
import { cache } from "react";

export const isLearningAdmin = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_growvelt_learning_admin");
  return !error && data === true;
});
