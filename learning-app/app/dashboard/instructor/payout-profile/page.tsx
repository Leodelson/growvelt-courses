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
  const activeTest = profiles.find((profile) => profile.status === "active" && profile.provider_domain === "test");
  const activeLive = profiles.find((profile) => profile.status === "active" && profile.provider_domain === "live");
  const liveProfileSetupEnabled = process.env.LEARNING_LIVE_PAYOUT_PROFILE_SETUP_ENABLED === "true";
  return <section className={`instructor-earnings-page section-shell ${styles.page}`}>
    <Link className={styles.back} href="/dashboard/instructor">← Back to instructor workspace</Link>
    <header className="instructor-earnings-hero"><p className="eyebrow">Payout profile</p><h1>Prepare a payout destination.</h1><p>Saving a recipient does not release earnings or transfer money. Transfers remain controlled separately by the Learning payout approval and submission gates.</p></header>
    {activeTest && <section className="payout-profile-summary"><p className="eyebrow">Active Test recipient</p><h2>{activeTest.account_name}</h2><p>{activeTest.bank_name} · account ending in {activeTest.account_last4}</p><code>{activeTest.recipient_code}</code><span>Test Mode · {activeTest.status}</span></section>}
    {activeLive && <section className="payout-profile-summary"><p className="eyebrow">Saved Live destination</p><h2>{activeLive.account_name}</h2><p>{activeLive.bank_name} · account ending in {activeLive.account_last4}</p><span>Live Mode · {activeLive.status} · no transfer created</span></section>}
    {!activeTest && <section className={styles.guide}><p className="eyebrow">Test recipient</p><h2>No Test recipient saved</h2><p>You can validate a Test Mode recipient below. This does not make earnings withdrawable or authorize a transfer.</p></section>}
    <PayoutProfileForm hasActiveProfile={Boolean(activeTest)} domain="test" />
    {liveProfileSetupEnabled
      ? <PayoutProfileForm hasActiveProfile={Boolean(activeLive)} domain="live" />
      : <section className={styles.guide}><p className="eyebrow">Live payout destination</p><h2>Live setup is off</h2><p>No Live recipient can be created until the separate profile setup gate is enabled.</p></section>}
    {profiles.filter((profile) => profile.status === "disabled").length > 0 && <section className="payout-profile-history"><h2>Profile history</h2><ul>{profiles.filter((profile) => profile.status === "disabled").map((profile) => <li key={profile.payout_profile_id}><span><strong>{profile.bank_name}</strong><small>Account ending in {profile.account_last4} · {profile.provider_domain === "test" ? "Test Mode" : "Live Mode"}</small></span><span>Disabled<small>{providerDate(profile.disabled_at)}</small></span></li>)}</ul></section>}
    <section className={styles.guide} aria-labelledby="payout-guide-title"><h2 id="payout-guide-title">Before you validate a recipient</h2><details><summary>What does this setup do?</summary><p>It validates and saves a Paystack recipient for the approved instructor account. This is not a withdrawal request and does not reserve or transfer earnings.</p></details><details><summary>Which bank details are needed?</summary><p>Use the Nigerian bank’s Paystack/NIBSS bank code, not a SWIFT or BIC code, and the 10-digit account number. After validation, Growvelt retains bank metadata, the account name and the last four digits, not the full account number.</p></details><details><summary>What happens when I replace or disable a profile?</summary><p>The selected Test or Live destination changes through its own profile control. Disabled profiles remain in history. Disabling a destination does not delete earnings or create a transfer.</p></details></section>
  </section>;
}
