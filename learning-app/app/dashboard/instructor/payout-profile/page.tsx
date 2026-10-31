import Link from "next/link";
import { redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorPayoutProfiles } from "@/app/lib/instructor/payout-profile";
import { PayoutProfileForm } from "@/app/components/instructor/payout-profile-form";

import { providerDate } from "@/app/lib/instructor/provider-workspaces";
import styles from "@/app/components/instructor/provider-workspaces.module.css";

export const metadata = { title: "Instructor payout profile" };

export default async function InstructorPayoutProfilePage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const profiles = await getOwnInstructorPayoutProfiles();
  const liveProfiles = profiles.filter((profile) => profile.provider_domain === "live");
  const active = liveProfiles.find((profile) => profile.status === "active");
  const liveProfileSetupEnabled = process.env.LEARNING_LIVE_PAYOUT_PROFILE_SETUP_ENABLED === "true";
  return <section className={`instructor-earnings-page section-shell ${styles.page}`}>
    <Link className={styles.back} href="/dashboard/instructor">← Back to instructor workspace</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Payout profile</p><h1>Prepare a future payout destination.</h1><p>Instructor payouts are not currently available. Saving a payout profile does not make earnings withdrawable, start a transfer, or promise a payment date.</p></header>
    {active && <section className="payout-profile-summary"><p className="eyebrow">Saved payout destination</p><h2>{active.account_name}</h2><p>{active.bank_name} · account ending in {active.account_last4}</p><span>Profile {active.status}</span></section>}
    {!active && <section className={styles.guide}><p className="eyebrow">No payout destination saved</p><h2>Your destination setup starts here.</h2><p>Saving a destination does not make earnings withdrawable, schedule a payout, or authorize a transfer.</p></section>}
    <PayoutProfileForm hasActiveProfile={Boolean(active)} liveProfileSetupEnabled={liveProfileSetupEnabled} />
    {liveProfiles.filter((profile) => profile.status === "disabled").length > 0 && <section className="payout-profile-history"><h2>Profile history</h2><ul>{liveProfiles.filter((profile) => profile.status === "disabled").map((profile) => <li key={profile.payout_profile_id}><span><strong>{profile.bank_name}</strong><small>Account ending in {profile.account_last4} · Saved profile</small></span><span>Disabled<small>{providerDate(profile.disabled_at)}</small></span></li>)}</ul></section>}
    <section className={styles.guide} aria-labelledby="payout-guide-title"><h2 id="payout-guide-title">Payout profile essentials</h2><details><summary>What does this setup do?</summary><p>It saves a payout destination for the approved instructor account. This is not a withdrawal request and does not reserve or transfer earnings.</p></details><details><summary>Which bank details are needed?</summary><p>Use your Nigerian bank’s NIBSS bank code, not a SWIFT or BIC code, and the 10-digit account number. Growvelt retains bank metadata, the account name and the last four digits, not the full account number.</p></details><details><summary>What happens when I replace or disable a profile?</summary><p>The saved destination changes through the existing profile controls. Disabled profiles remain in history. Disabling a destination does not delete earnings or create a transfer.</p></details></section>
  </section>;
}
