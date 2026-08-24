import { createClient } from "@/app/lib/supabase/server";

type FixtureEligibilityRow = { eligible: boolean; fixture_id: number | null; expires_at: string | null };

export async function getOwnPaystackTestFixtureEligibility(courseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_own_paystack_test_fixture_eligibility", { p_course_id: courseId });
  if (error) return { eligible: false, fixtureId: null, expiresAt: null };
  const row = (data as FixtureEligibilityRow[] | null)?.[0];
  return {
    eligible: row?.eligible === true,
    fixtureId: typeof row?.fixture_id === "number" ? row.fixture_id : null,
    expiresAt: typeof row?.expires_at === "string" ? row.expires_at : null,
  };
}
