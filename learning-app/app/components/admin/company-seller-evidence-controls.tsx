"use client";

import { useId, useState } from "react";

type ControlState = "idle" | "saving" | "saved" | "failed";

export function CompanyTransferEvidenceControl({
  purchaseId,
  transferReference,
  actionClassName,
  errorClassName,
}: {
  purchaseId: number;
  transferReference: string;
  actionClassName: string;
  errorClassName: string;
}) {
  const [state, setState] = useState<ControlState>("idle");
  const id = useId();

  async function submit(formData: FormData) {
    setState("saving");
    try {
      const response = await fetch("/api/admin/payments/company-transfer-evidence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, transferReference: formData.get("transferReference") }),
      });
      setState(response.ok ? "saved" : "failed");
      if (response.ok) window.location.reload();
    } catch {
      setState("failed");
    }
  }

  return <form className={actionClassName} action={submit}>
    <label htmlFor={id}>Transfer reference</label>
    <input id={id} name="transferReference" required maxLength={50} pattern="lcs-[a-z0-9_-]{12,46}"
      defaultValue={transferReference} autoComplete="off" />
    <button className="button button-secondary" type="submit" disabled={state === "saving"}>
      {state === "saving" ? "Verifying…" : "Verify existing transfer"}
    </button>
    {state === "failed" && <p className={errorClassName} role="alert">The transfer was not verified or recorded. No transfer was initiated.</p>}
  </form>;
}

export function CompanyBankSettlementEvidenceControl({
  purchaseId,
  settlementId,
  actionClassName,
  errorClassName,
}: {
  purchaseId: number;
  settlementId: string;
  actionClassName: string;
  errorClassName: string;
}) {
  const [state, setState] = useState<ControlState>("idle");
  const id = useId();

  async function submit(formData: FormData) {
    const amount = String(formData.get("bankCreditAmount") ?? "").trim();
    const bankStatementReference = String(formData.get("bankStatementReference") ?? "").trim();
    const bankCreditDate = String(formData.get("bankCreditDate") ?? "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
      setState("failed");
      return;
    }
    const bankCreditAmountMinor = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(bankCreditAmountMinor) || bankCreditAmountMinor <= 0
        || bankStatementReference.length < 3 || bankStatementReference.length > 120
        || !/^\d{4}-\d{2}-\d{2}$/.test(bankCreditDate)) {
      setState("failed");
      return;
    }

    setState("saving");
    try {
      const response = await fetch("/api/admin/payments/company-settlement/reconcile-bank", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, settlementId, bankCreditAmountMinor,
          bankStatementReference, bankCreditDate }),
      });
      setState(response.ok ? "saved" : "failed");
      if (response.ok) window.location.reload();
    } catch {
      setState("failed");
    }
  }

  return <form className={actionClassName} action={submit}>
    <p>First compare this payout in Paystack with the actual bank statement. Enter the credited amount and exact statement-line reference below; a mismatch will not be recorded.</p>
    <label htmlFor={`${id}-amount`}>Bank credit amount (NGN)</label>
    <input id={`${id}-amount`} name="bankCreditAmount" type="number" min="0.01" step="0.01" required />
    <label htmlFor={`${id}-date`}>Bank credit date</label>
    <input id={`${id}-date`} name="bankCreditDate" type="date" required />
    <label htmlFor={`${id}-reference`}>Bank statement line reference</label>
    <input id={`${id}-reference`} name="bankStatementReference" required minLength={3} maxLength={120} autoComplete="off" />
    <button className="button button-secondary" type="submit" disabled={state === "saving"}>
      {state === "saving" ? "Verifying…" : "Record bank statement match"}
    </button>
    {state === "failed" && <p className={errorClassName} role="alert">The statement line did not match the verified Paystack settlement, or could not be recorded. Seller funds remain held.</p>}
  </form>;
}

export function CompanyRecoveryReceiptControl({
  purchaseId,
  outstandingMinor,
  actionClassName,
  errorClassName,
}: {
  purchaseId: number;
  outstandingMinor: number;
  actionClassName: string;
  errorClassName: string;
}) {
  const [state, setState] = useState<ControlState>("idle");
  const id = useId();

  async function submit(formData: FormData) {
    const amount = String(formData.get("amount") ?? "").trim();
    const paymentReference = String(formData.get("paymentReference") ?? "").trim();
    const paymentMethod = formData.get("paymentMethod");
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !paymentReference) {
      setState("failed");
      return;
    }
    const amountMinor = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > outstandingMinor) {
      setState("failed");
      return;
    }

    setState("saving");
    try {
      const response = await fetch("/api/admin/payments/company-recovery-receipts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, amountMinor, paymentMethod, paymentReference }),
      });
      setState(response.ok ? "saved" : "failed");
      if (response.ok) window.location.reload();
    } catch {
      setState("failed");
    }
  }

  return <form className={actionClassName} action={submit}>
    <label htmlFor={`${id}-amount`}>Confirmed repayment amount (NGN)</label>
    <input id={`${id}-amount`} name="amount" type="number" min="0.01" step="0.01" max={outstandingMinor / 100} required />
    <label htmlFor={`${id}-method`}>How repayment was received</label>
    <select id={`${id}-method`} name="paymentMethod" defaultValue="bank_transfer">
      <option value="bank_transfer">Bank transfer</option>
      <option value="other">Other verified method</option>
    </select>
    <label htmlFor={`${id}-reference`}>Bank/provider reference</label>
    <input id={`${id}-reference`} name="paymentReference" required maxLength={160} autoComplete="off" />
    <button className="button button-secondary" type="submit" disabled={state === "saving"}>
      {state === "saving" ? "Recording…" : "Record confirmed repayment"}
    </button>
    {state === "failed" && <p className={errorClassName} role="alert">The receipt could not be recorded. Confirm the repayment independently; this form does not collect money.</p>}
  </form>;
}
