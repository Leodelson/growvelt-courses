"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";

type Props = { hasActiveProfile: boolean };

export function PayoutProfileForm({ hasActiveProfile }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [operation, setOperation] = useState<"validate" | "disable">("validate");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const accountNumber = String(form.get("accountNumber") ?? "").trim();
    const bankCode = String(form.get("bankCode") ?? "").trim();
    setOperation("validate"); setPending(true); setMessage(null); setError(false);
    try {
      const response = await fetch("/api/instructor/payout-profile", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountNumber, bankCode }) });
      if (!response.ok) throw new Error("unavailable");
      setMessage("Your payout profile is saved. Only masked account details are retained.");
      formElement.reset(); router.refresh();
    } catch { setError(true); setMessage("We could not validate that account safely. Check the details and try again."); }
    finally { setPending(false); }
  }
  async function disable() {
    if (pending) return;
    setOperation("disable"); setPending(true); setMessage(null); setError(false);
    try {
      const response = await fetch("/api/instructor/payout-profile", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("unavailable");
      setMessage("The payout profile is disabled. No transfer was created."); router.refresh();
    } catch { setError(true); setMessage("The profile could not be disabled safely."); }
    finally { setPending(false); setConfirmDisable(false); }
  }
  return <section className="payout-profile-panel">
    <header><p className="eyebrow">Payout destination</p><h2>{hasActiveProfile ? "Replace payout profile" : "Add payout profile"}</h2><p>Growvelt retains only bank metadata, the account name, and the last four digits. Instructor payouts are not currently available; this profile does not release earnings or start a transfer.</p></header>
    <form className="payout-profile-form" onSubmit={submit}>
      <label className="course-field">Bank code (not SWIFT/BIC)<input name="bankCode" inputMode="numeric" pattern="[A-Za-z0-9_-]{2,32}" maxLength={32} required /><span>Enter your Nigerian bank’s NIBSS bank code. Do not enter a SWIFT or BIC code.</span></label>
      <label className="course-field">Account number<input name="accountNumber" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required /><span>Only the last four digits are retained after validation.</span></label>
      <ActionButton className="button button-primary" type="submit" disabled={pending} isPending={pending && operation === "validate"} pendingLabel="Validating…">{hasActiveProfile ? "Replace payout profile" : "Save payout profile"}</ActionButton>
    </form>
    {hasActiveProfile && <button className="button button-secondary" type="button" onClick={() => setConfirmDisable(true)} disabled={pending}>Disable current profile</button>}
    {confirmDisable && <ConfirmationDialog title="Disable this payout profile?" description={<p>This disables your saved payout destination. No transfer is created and your earnings are unchanged.</p>} confirmLabel="Disable payout profile" pendingLabel="Disabling…" tone="danger" isPending={pending} onCancel={() => !pending && setConfirmDisable(false)} onConfirm={disable} />}
    {message && <p className={error ? "payout-profile-feedback is-error" : "payout-profile-feedback"} role="status">{message}</p>}
  </section>;
}
