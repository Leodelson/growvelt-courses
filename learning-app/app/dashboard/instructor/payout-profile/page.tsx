import { redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorPayoutProfiles } from "@/app/lib/instructor/payout-profile";
import { PayoutProfileForm } from "@/app/components/instructor/payout-profile-form";

export const metadata = { title: "Instructor payout profile" };

export default async function InstructorPayoutProfilePage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const profiles = await getOwnInstructorPayoutProfiles();
  const active = profiles.find((profile) => profile.status === "active" && profile.provider_domain === "test");
  return <section className="instructor-earnings-page section-shell">
    <header className="instructor-earnings-hero"><p className="eyebrow">Payout profile</p><h1>Prepare a future payout destination.</h1><p>This page only validates a Paystack Test-mode recipient. It does not reserve earnings, start a transfer, or make funds withdrawable.</p></header>
    {active && <section className="payout-profile-summary"><p className="eyebrow">Active Test recipient</p><h2>{active.account_name}</h2><p>{active.bank_name} · account ending in {active.account_last4}</p><code>{active.recipient_code}</code><span>Test Mode · {active.status}</span></section>}
    <PayoutProfileForm hasActiveProfile={Boolean(active)} />
    {profiles.filter((profile) => profile.status === "disabled").length > 0 && <section className="payout-profile-history"><h2>Profile history</h2>{profiles.filter((profile) => profile.status === "disabled").map((profile) => <p key={profile.payout_profile_id}>{profile.bank_name} · account ending in {profile.account_last4} · disabled</p>)}</section>}
  </section>;
}
