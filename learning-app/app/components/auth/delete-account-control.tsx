"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

type Step = "closed" | "reason" | "confirm";
const reasons = ["I no longer use Growvelt Learning", "I prefer another learning platform", "I had a technical issue", "I have privacy concerns", "I created another account", "Other"] as const;

export function DeleteAccountControl() {
  const [step, setStep] = useState<Step>("closed");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (step !== "closed") closeRef.current?.focus(); }, [step]);

  function close() {
    if (busy) return;
    setStep("closed");
    setSelectedReasons([]);
    setDetail("");
    setConfirmation("");
    setMessage("");
  }

  function toggleReason(item: string) {
    setSelectedReasons((current) => current.includes(item) ? current.filter((reason) => reason !== item) : [...current, item]);
  }

  function continueToConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReasons.length) return setMessage("Choose at least one reason before continuing.");
    if (selectedReasons.includes("Other") && !detail.trim()) return setMessage("Briefly tell us why you are leaving.");
    setMessage("");
    setStep("confirm");
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function deleteAccount() {
    if (confirmation.trim().toUpperCase() !== "DELETE") { setMessage("Type DELETE exactly to confirm account deletion."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reasons: selectedReasons, detail: detail.trim() || undefined }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        if (body?.code === "not_configured") throw new Error("Account deletion is not configured on this deployment yet.");
        if (body?.code === "not_signed_in") throw new Error("Your session has expired. Please sign in again before deleting your account.");
        throw new Error("We couldn’t complete the deletion. Please try again or contact support.");
      }
      await createClient().auth.signOut().catch(() => undefined);
      window.location.assign("/sign-in?account=deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t delete your account. Please try again or contact support.");
      setBusy(false);
    }
  }

  const dialog = step !== "closed" && <div className="account-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="account-delete-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" onKeyDown={handleDialogKeyDown}>
      <header><div><p className="eyebrow">Account deletion</p><h2 id="delete-account-title">{step === "reason" ? "Before you delete your account" : "Delete your Learning account?"}</h2>{step === "reason" && <p className="account-delete-intro">Your feedback helps us improve Growvelt Learning.</p>}</div><button ref={closeRef} type="button" className="account-delete-close" onClick={close} disabled={busy} aria-label="Close account deletion">×</button></header>
      {step === "reason" ? <form onSubmit={continueToConfirmation} className="account-delete-form"><fieldset><legend>Why are you leaving?</legend><div className="account-delete-reason-grid">{reasons.map((item) => <label key={item} className="account-delete-reason"><input type="checkbox" checked={selectedReasons.includes(item)} onChange={() => toggleReason(item)} disabled={busy} /><span>{item}</span></label>)}</div></fieldset><label className="field-label">Tell us more<textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={700} rows={4} placeholder="Share anything that would have made your experience better." disabled={busy} /><small>Optional unless you select Other. {detail.length}/700</small></label>{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<footer><button className="button button-secondary" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button button-danger" type="submit" disabled={busy}>Continue</button></footer></form> : <div className="account-delete-form"><p>Deleting your account permanently removes your Learning profile and any related account data configured to cascade with it. This cannot be undone.</p><label className="field-label">Type <strong>DELETE</strong> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} /></label>{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<footer><button className="button button-secondary" type="button" onClick={() => { setMessage(""); setStep("reason"); }} disabled={busy}>Back</button><ActionButton className="button button-danger" type="button" onClick={deleteAccount} isPending={busy} pendingLabel="Deleting account…">Permanently delete account</ActionButton></footer></div>}
    </section>
  </div>;

  return <><button type="button" className="button button-danger" onClick={() => setStep("reason")} aria-haspopup="dialog" aria-expanded={step !== "closed"}>Delete account</button>{mounted && dialog ? createPortal(dialog, document.body) : null}</>;
}
