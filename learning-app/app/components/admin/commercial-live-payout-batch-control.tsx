"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { InstructorLivePayoutBatch, InstructorLivePayoutBatchCandidate, InstructorLivePayoutBatchFinding } from "@/app/lib/admin/commercial-operations";

type Props = {
  candidates: InstructorLivePayoutBatchCandidate[];
  batches: InstructorLivePayoutBatch[];
  findings: InstructorLivePayoutBatchFinding[];
  submissionEnabled: boolean;
  invoiceSubmissionEnabled: boolean;
  otpEnabled: boolean;
  recoveryEnabled: boolean;
  invoiceRecoveryEnabled: boolean;
};

const money = (minor: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 2,
}).format(minor / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

type BatchAction = "submit" | "otp" | "recover";

export function CommercialLivePayoutBatchControl({ candidates, batches, findings, submissionEnabled, invoiceSubmissionEnabled, otpEnabled, recoveryEnabled, invoiceRecoveryEnabled }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [amountConfirmation, setAmountConfirmation] = useState("");
  const [referenceConfirmation, setReferenceConfirmation] = useState<Record<number, string>>({});
  const [otp, setOtp] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; text: string; error?: boolean } | null>(null);

  const groups = useMemo(() => {
    const result = new Map<string, InstructorLivePayoutBatchCandidate[]>();
    for (const candidate of candidates) {
      const key = `${candidate.source_type}:${candidate.instructor_id}:${candidate.payout_profile_id}`;
      result.set(key, [...(result.get(key) ?? []), candidate]);
    }
    return [...result.entries()];
  }, [candidates]);
  const selectedCandidates = candidates.filter(candidate => selected.includes(candidate.earning_id));
  const selectedAmount = selectedCandidates.reduce((sum, candidate) => sum + candidate.amount_minor, 0);
  const selectedIdentity = selectedCandidates[0];
  const oneRecipient = selectedCandidates.length > 0 && selectedCandidates.every(candidate =>
    candidate.source_type === selectedIdentity?.source_type
      && candidate.instructor_id === selectedIdentity?.instructor_id
      && candidate.payout_profile_id === selectedIdentity.payout_profile_id);
  const approvalReady = oneRecipient && selectedCandidates.length <= 100 && selectedAmount >= 100000
    && amountConfirmation === (selectedAmount / 100).toFixed(2) && busy === null;

  function toggle(earningId: number, checked: boolean) {
    setNotice(null);
    setSelected(current => checked
      ? current.includes(earningId) ? current : [...current, earningId]
      : current.filter(id => id !== earningId));
    setAmountConfirmation("");
  }

  async function approve() {
    if (!approvalReady || !selectedIdentity) return;
    const amount = selectedAmount;
    if (!window.confirm(`Reserve ${selectedCandidates.length} earnings totalling ${money(amount)} for ${selectedIdentity.instructor_name ?? "this instructor"}, ${selectedIdentity.bank_name} account ending ${selectedIdentity.account_last4}? This creates an approved batch but does not initiate a provider transfer.`)) return;
    setBusy("approve");
    setNotice(null);
    try {
      const response = await fetch("/api/admin/commercial/payout-batches/approve", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId: selectedIdentity.instructor_id,
          sourceType: selectedIdentity.source_type,
          payoutProfileId: selectedIdentity.payout_profile_id,
          earningIds: selectedCandidates.map(candidate => candidate.earning_id),
          confirmedAmountMinor: amount, idempotencyKey: `batch:approve:${crypto.randomUUID()}` }),
      });
      const result = await response.json().catch(() => null) as { batch_reference?: string } | null;
      if (!response.ok || !result?.batch_reference) throw new Error("The batch could not be approved. Refresh and review the latest eligibility.");
      setSelected([]);
      setAmountConfirmation("");
      setNotice({ key: "approve", text: `${result.batch_reference} is approved and its earnings are reserved. No transfer was initiated.` });
      router.refresh();
    } catch (error) {
      setNotice({ key: "approve", text: error instanceof Error ? error.message : "Batch approval requires review.", error: true });
    } finally { setBusy(null); }
  }

  async function runBatchAction(batch: InstructorLivePayoutBatch, action: BatchAction) {
    const key = `${action}:${batch.batch_id}`;
    if (busy) return;
    if (action === "submit" && referenceConfirmation[batch.batch_id] !== batch.batch_reference) return;
    const otpValue = otp[batch.batch_id] ?? "";
    if (action === "otp" && !/^\d{6}$/.test(otpValue)) return;
    const actionCopy = action === "submit" ? "Start one Live transfer for" : action === "otp" ? "Confirm this transfer OTP for" : "Check the provider status of";
    if (!window.confirm(`${actionCopy} ${batch.batch_reference}, ${money(batch.amount_minor)} to ${batch.bank_name} account ending ${batch.account_last4}?`)) {
      if (action === "otp") setOtp(current => ({ ...current, [batch.batch_id]: "" }));
      return;
    }
    setBusy(key);
    setNotice(null);
    try {
      const endpoint = action === "submit" ? "/api/admin/commercial/payout-batches/submit-live"
        : action === "otp" ? "/api/admin/commercial/payout-batches/finalize-live-otp"
          : "/api/admin/commercial/payout-batches/recover-live";
      const body = action === "submit"
        ? { batchId: batch.batch_id, sourceType: batch.source_type, idempotencyKey: `batch:submit:${crypto.randomUUID()}` }
        : action === "otp" ? { attemptId: batch.attempt_id, otp: otpValue }
          : { attemptId: batch.attempt_id };
      if (action === "otp") setOtp(current => ({ ...current, [batch.batch_id]: "" }));
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null) as { status?: string; code?: string } | null;
      if (!response.ok && result?.code === "live_batch_balance_preflight_failed") {
        throw new Error("No transfer was started. Available balance could not be confirmed for this batch and its safety allowance. Check the transfer balance before trying again.");
      }
      if (!response.ok) throw new Error("The request needs review. Verify the batch reference before retrying.");
      const text = action === "recover" ? `Provider status check recorded: ${result?.status ?? "review required"}.`
        : action === "otp" ? "OTP response recorded. Wait for the provider outcome; do not submit another OTP."
          : result?.status === "verification_required"
            ? "This attempt already exists and was not re-submitted. Verify its reference before any action."
            : `Transfer request recorded (${result?.status ?? "pending"}). This is not proof of bank settlement.`;
      setNotice({ key, text });
      router.refresh();
    } catch (error) {
      setNotice({ key, text: error instanceof Error ? error.message : "The operation needs review.", error: true });
    } finally { setBusy(null); }
  }

  return <div className="commercial-live-payout-batch-workspace">
    <section className="commercial-live-payout-batch-panel" aria-labelledby="live-batch-candidates-title">
      <header><p className="eyebrow">Step 1</p><h3 id="live-batch-candidates-title">Select eligible earnings</h3>
        <p>Choose one instructor and recipient. Minimum batch: ₦1,000. Approval only reserves earnings.</p></header>
      {groups.length ? <div className="commercial-live-payout-batch-groups">{groups.map(([groupKey, rows]) => {
        const first = rows[0];
        const count = selected.filter(id => rows.some(row => row.earning_id === id)).length;
        return <section className="commercial-live-payout-batch-group" key={groupKey}>
          <div className="commercial-live-payout-batch-recipient">
            <div><strong>{first.instructor_name ?? "Instructor"}</strong><span>{first.instructor_email ?? "Email unavailable"}</span></div>
            <div><strong>{first.bank_name}</strong><span>{first.account_name} · account ending {first.account_last4}</span></div>
            <span>{count} selected · available total {money(first.eligible_total_minor)}</span>
          </div>
          <div className="commercial-live-payout-batch-earnings">{rows.map(row => <label key={row.earning_id}>
            <input type="checkbox" checked={selected.includes(row.earning_id)} onChange={event => toggle(row.earning_id, event.target.checked)} disabled={busy !== null} />
            <span><strong>{row.source_label}</strong><small>{row.source_reference}</small></span>
            <strong>{money(row.amount_minor)}</strong>
          </label>)}</div>
        </section>;
      })}</div> : <p className="admin-empty-copy">No batch is ready yet. Available earnings for one instructor must reach ₦1,000.</p>}
      {selected.length > 0 && <div className="commercial-live-payout-batch-confirmation">
        <p><strong>Selected total: {money(selectedAmount)}</strong> · {selected.length} earnings</p>
        {!oneRecipient && <p className="commercial-release-result is-error">Select earnings for only one instructor and recipient at a time.</p>}
        {selectedCandidates.length > 100 && <p className="commercial-release-result is-error">A single batch can contain at most 100 earnings.</p>}
        {selectedAmount < 100000 && <p>The selected amount must reach NGN 1,000 before approval.</p>}
        <label>Type the exact amount in naira ({(selectedAmount / 100).toFixed(2)}) to approve
          <input inputMode="decimal" autoComplete="off" value={amountConfirmation} onChange={event => setAmountConfirmation(event.target.value)} disabled={busy !== null} />
        </label>
        <button type="button" className="button button-primary" onClick={approve} disabled={!approvalReady}>
          {busy === "approve" ? "Approving…" : "Approve and reserve selected earnings"}
        </button>
      </div>}
      {notice?.key === "approve" && <p className={`commercial-release-result${notice.error ? " is-error" : ""}`} role="status">{notice.text}</p>}
    </section>

    <section className="commercial-live-payout-batch-panel" aria-labelledby="live-batch-history-title">
      <header><p className="eyebrow">Step 2</p><h3 id="live-batch-history-title">Approved batches</h3>
        <p>Transfer initiation is separate from approval. A submitted transfer is not yet a completed payout.</p></header>
      {batches.length ? <div className="commercial-live-payout-batch-groups">{batches.map(batch => {
        const sourceSubmissionEnabled = batch.source_type === "subscription_invoice" ? invoiceSubmissionEnabled : submissionEnabled;
        const allowSubmit = sourceSubmissionEnabled && ["assembled", "failed"].includes(batch.status);
        const allowOtp = sourceSubmissionEnabled && otpEnabled && batch.attempt_id !== null && batch.attempt_status === "pending" && batch.provider_status === "otp";
        const sourceRecoveryEnabled = batch.source_type === "subscription_invoice" ? invoiceRecoveryEnabled : recoveryEnabled;
        const allowRecover = sourceRecoveryEnabled && batch.attempt_id !== null && ["pending", "recovery_required", "financially_blocked"].includes(batch.attempt_status ?? "");
        const displayStatus = batch.status === "assembled" ? "approved · awaiting transfer" : batch.status.replaceAll("_", " ");
        return <article className="commercial-live-payout-batch-history" key={batch.batch_id}>
          <div><strong>{batch.instructor_name ?? "Instructor"}</strong><span>{batch.source_type === "subscription_invoice" ? "Subscription invoice batch" : "Course order batch"} · {batch.batch_reference} · {batch.member_count} earnings</span><span>Approved {date(batch.assembled_at)}</span></div>
          <div><strong>{money(batch.amount_minor)} · {batch.bank_name}</strong><span>{batch.account_name} · account ending {batch.account_last4}</span></div>
          <div><span className={`admin-status is-${batch.status}`}>{displayStatus}</span><span>{batch.attempt_reference ? `${batch.attempt_reference} · ${batch.attempt_status}${batch.provider_status ? ` · provider ${batch.provider_status}` : ""}` : "No provider transfer submitted"}</span>{batch.attempted_at && <span>Last attempt {date(batch.attempted_at)}</span>}{batch.provider_transfer_code && <span>Provider transfer code {batch.provider_transfer_code}</span>}</div>
          {allowSubmit && <div className="commercial-live-payout-batch-actions">
            <label>Type {batch.batch_reference} to initiate one Live transfer
              <input autoComplete="off" spellCheck={false} value={referenceConfirmation[batch.batch_id] ?? ""} onChange={event => setReferenceConfirmation(current => ({ ...current, [batch.batch_id]: event.target.value }))} disabled={busy !== null} />
            </label>
            <button type="button" className="button button-primary" onClick={() => runBatchAction(batch, "submit")} disabled={busy !== null || referenceConfirmation[batch.batch_id] !== batch.batch_reference}>{busy === `submit:${batch.batch_id}` ? "Submitting…" : "Initiate Live transfer"}</button>
          </div>}
          {allowOtp && <div className="commercial-live-payout-batch-actions">
            <label>Transfer confirmation code
              <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={otp[batch.batch_id] ?? ""} onChange={event => setOtp(current => ({ ...current, [batch.batch_id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))} disabled={busy !== null} />
            </label>
            <button type="button" className="button button-primary" onClick={() => runBatchAction(batch, "otp")} disabled={busy !== null || !/^\d{6}$/.test(otp[batch.batch_id] ?? "")}>{busy === `otp:${batch.batch_id}` ? "Confirming…" : "Confirm transfer code"}</button>
          </div>}
          {allowRecover && <button type="button" className="button" onClick={() => runBatchAction(batch, "recover")} disabled={busy !== null}>{busy === `recover:${batch.batch_id}` ? "Checking…" : "Verify provider status"}</button>}
          {notice?.key.endsWith(`:${batch.batch_id}`) && <p className={`commercial-release-result${notice.error ? " is-error" : ""}`} role="status">{notice.text}</p>}
        </article>;
      })}</div> : <p className="admin-empty-copy">No Live payout batches have been approved.</p>}
    </section>

    <section className="commercial-live-payout-batch-panel" aria-labelledby="live-batch-findings-title">
      <header><p className="eyebrow">Follow-up</p><h3 id="live-batch-findings-title">Issues requiring review</h3></header>
      {findings.length ? <div className="commercial-live-payout-batch-groups">{findings.map(finding => <article className="commercial-live-payout-batch-history" key={finding.finding_id}>
        <div><strong>{finding.finding_type.replaceAll("_", " ")}</strong><span>{finding.attempt_reference ?? "No matched transfer attempt"}</span></div>
        <div><span>{finding.detail}</span></div>
        <div><span className={`admin-status is-${finding.status}`}>{finding.status}</span><span>Recorded {date(finding.created_at)}</span></div>
      </article>)}</div> : <p className="admin-empty-copy">No Live payout batch findings.</p>}
    </section>
  </div>;
}
