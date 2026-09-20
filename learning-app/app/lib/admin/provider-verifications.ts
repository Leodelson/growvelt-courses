import { createClient } from "@/app/lib/supabase/server";

export type PendingProviderVerification = { organization_id: number; organization_name: string; organization_slug: string; legal_name: string; contact_email: string; website_url: string | null; verification_statement: string; submitted_at: string; submitted_by_name: string | null; submitted_by_email: string };

export async function getPendingProviderVerifications() {
  const { data, error } = await (await createClient()).rpc("list_pending_learning_provider_organization_verifications");
  if (error) throw new Error("Unable to load provider verification requests.");
  return (data ?? []) as PendingProviderVerification[];
}
