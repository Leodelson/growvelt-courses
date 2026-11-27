import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient(env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Growvelt server database access is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
