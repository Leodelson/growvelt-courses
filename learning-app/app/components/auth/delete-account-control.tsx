"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

type Step = "closed" | "reason" | "confirm";
type CertificateChoice = "keep_verifiable" | "remove_public_verification" | "";
const reasonKeys = ["delete.reasonUnused", "delete.reasonAlternative", "delete.reasonTechnical", "delete.reasonPrivacy", "delete.reasonAnother", "delete.reasonOther"] as const;

export function DeleteAccountControl() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("closed");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [certificateChoice, setCertificateChoice] = useState<CertificateChoice>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => { if (step !== "closed") closeRef.current?.focus(); }, [step]);

  function close() {
    if (busy) return;
    setStep("closed");
    setSelectedReasons([]);
    setDetail("");
    setConfirmation("");
    setCertificateChoice("");
    setMessage("");
  }

  function toggleReason(item: string) {
    setSelectedReasons((current) => current.includes(item) ? current.filter((reason) => reason !== item) : [...current, item]);
  }

  function continueToConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReasons.length) return setMessage(t("delete.choose"));
    if (selectedReasons.includes(t("delete.reasonOther")) && !detail.trim()) return setMessage(t("delete.otherRequired"));
    if (!certificateChoice) return setMessage(t("delete.certificateChoiceRequired"));
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
    if (confirmation.trim().toUpperCase() !== "DELETE") { setMessage(t("delete.typeDelete")); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reasons: selectedReasons, detail: detail.trim() || undefined, certificateChoice }) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { code?: string } | null;
        if (body?.code === "not_configured") throw new Error(t("delete.notConfigured"));
        if (body?.code === "not_signed_in") throw new Error(t("delete.notSignedIn"));
        if (body?.code === "certificate_choice_required") throw new Error(t("delete.certificateChoiceRequired"));
        if (body?.code === "admin_offboarding_required") throw new Error(t("delete.adminOffboarding"));
        if (body?.code === "instructor_offboarding_required") throw new Error(t("delete.instructorOffboarding"));
        throw new Error(t("delete.failed"));
      }
      await createClient().auth.signOut().catch(() => undefined);
      window.location.assign("/sign-in?account=deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("delete.failed"));
      setBusy(false);
    }
  }

  const dialog = step !== "closed" && <div className="account-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="account-delete-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" onKeyDown={handleDialogKeyDown}>
      <header><div><p className="eyebrow">{t("delete.eyebrow")}</p><h2 id="delete-account-title">{step === "reason" ? t("delete.before") : t("delete.confirmTitle")}</h2>{step === "reason" && <p className="account-delete-intro">{t("delete.intro")}</p>}</div><button ref={closeRef} type="button" className="account-delete-close" onClick={close} disabled={busy} aria-label="Close account deletion">×</button></header>
      {step === "reason" ? <form onSubmit={continueToConfirmation} className="account-delete-form"><fieldset><legend>{t("delete.reason")}</legend><div className="account-delete-reason-grid">{reasonKeys.map((key) => { const item = t(key); return <label key={key} className="account-delete-reason"><input type="checkbox" checked={selectedReasons.includes(item)} onChange={() => toggleReason(item)} disabled={busy} /><span>{item}</span></label>; })}</div></fieldset><fieldset><legend>{t("delete.certificateLegend")}</legend><p className="account-delete-choice-intro">{t("delete.certificateIntro")}</p><div className="account-delete-certificate-grid"><label className="account-delete-certificate-choice"><input type="radio" name="certificate-choice" value="keep_verifiable" checked={certificateChoice === "keep_verifiable"} onChange={() => setCertificateChoice("keep_verifiable")} disabled={busy} /><span><strong>{t("delete.keepCertificates")}</strong><small>{t("delete.keepCertificatesCopy")}</small></span></label><label className="account-delete-certificate-choice"><input type="radio" name="certificate-choice" value="remove_public_verification" checked={certificateChoice === "remove_public_verification"} onChange={() => setCertificateChoice("remove_public_verification")} disabled={busy} /><span><strong>{t("delete.removeCertificates")}</strong><small>{t("delete.removeCertificatesCopy")}</small></span></label></div></fieldset><label className="field-label">{t("delete.more")}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={700} rows={4} placeholder={t("delete.placeholder")} disabled={busy} /><small>{t("delete.optional")} {detail.length}/700</small></label>{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<footer><button className="button button-secondary" type="button" onClick={close} disabled={busy}>{t("delete.cancel")}</button><button className="button button-danger" type="submit" disabled={busy}>{t("delete.continue")}</button></footer></form> : <div className="account-delete-form"><p>{t("delete.confirmCopy")}</p><p className="account-delete-certificate-summary">{certificateChoice === "keep_verifiable" ? t("delete.keepSummary") : t("delete.removeSummary")}</p><label className="field-label">{t("delete.confirmInstruction")}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} /></label>{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<footer><button className="button button-secondary" type="button" onClick={() => { setMessage(""); setStep("reason"); }} disabled={busy}>{t("delete.back")}</button><ActionButton className="button button-danger" type="button" onClick={deleteAccount} isPending={busy} pendingLabel={t("delete.pending")}>{t("delete.permanent")}</ActionButton></footer></div>}
    </section>
  </div>;

  return <><button type="button" className="button button-danger" onClick={() => setStep("reason")} aria-haspopup="dialog" aria-expanded={step !== "closed"}>{t("settings.delete")}</button>{mounted && dialog ? createPortal(dialog, document.body) : null}</>;
}
