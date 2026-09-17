"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = { hasActiveProfile: boolean };

export function PayoutProfileForm({ hasActiveProfile }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const accountNumber = String(form.get("accountNumber") ?? "").trim();
    const bankCode = String(form.get("bankCode") ?? "").trim();
    setPending(true); setMessage(null); setError(false);
    try {
      const response = await fetch("/api/instructor/payout-profile", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountNumber, bankCode }) });
      if (!response.ok) throw new Error("unavailable");
      setMessage("Your Test-mode payout profile is saved. Only masked account details are retained.");
      event.currentTarget.reset(); router.refresh();
    } catch { setError(true); setMessage("We could not validate that account safely. Check the details and try again."); }
    finally { setPending(false); }
  }
  async function disable() {
    if (pending) return;
    setPending(true); setMessage(null); setError(false);
    try {
      const response = await fetch("/api/instructor/payout-profile", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      setMessage("The payout profile is disabled. No transfer was created."); router.refresh();
    } catch { setError(true); setMessage("The profile could not be disabled safely."); }
    finally { setPending(false); }
  }
  return <section className="payout-profile-panel">
    <header><p className="eyebrow">Test-mode recipient</p><h2>{hasActiveProfile ? "Replace payout profile" : "Add payout profile"}</h2><p>Account validation uses Paystack Test Mode. Growvelt retains only bank metadata, the account name, and the last four digits. No payout or transfer is available.</p></header>
    <form className="payout-profile-form" onSubmit={submit}>
      <label className="course-field">Bank code<input name="bankCode" inputMode="numeric" pattern="[A-Za-z0-9_-]{2,32}" maxLength={32} required /><span>Use the Paystack bank code.</span></label>
      <label className="course-field">Account number<input name="accountNumber" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required /><span>Only the last four digits are retained after validation.</span></label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Validating…" : hasActiveProfile ? "Replace Test recipient" : "Validate Test recipient"}</button>
    </form>
    {hasActiveProfile && <button className="button button-secondary" type="button" onClick={disable} disabled={pending}>Disable current profile</button>}
    {message && <p className={error ? "payout-profile-feedback is-error" : "payout-profile-feedback"} role="status">{message}</p>}
  </section>;
}
