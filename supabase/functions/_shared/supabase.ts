import { jsonResponse } from "./cors.ts";

export function getSupabaseEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

export async function supabaseRest(path: string, options: RequestInit = {}) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${message}`);
  }

  if (response.status === 204) return null;
  return response.json();
}
