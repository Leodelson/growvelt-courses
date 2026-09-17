import { createClient } from "@/app/lib/supabase/server";

export type InstructorPayoutProfile = {
  payout_profile_id: number;
  status: "active" | "disabled";
  provider: "paystack";
  provider_domain: "test" | "live";
  recipient_code: string;
  currency: "NGN";
  bank_code: string;
  bank_name: string;
  account_name: string;
  account_last4: string;
  created_at: string;
  disabled_at: string | null;
};

export async function getOwnInstructorPayoutProfiles() {
  const { data, error } = await (await createClient()).rpc("get_own_learning_instructor_payout_profiles");
  if (error) throw new Error("Unable to load payout profile.");
  return (data ?? []) as InstructorPayoutProfile[];
}
