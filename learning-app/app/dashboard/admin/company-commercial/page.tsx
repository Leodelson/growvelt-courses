import { CompanyBankSettlementEvidenceControl, CompanyRecoveryReceiptControl, CompanyTransferEvidenceControl } from "@/app/components/admin/company-seller-evidence-controls";
import { createAdminClient } from "@/app/lib/supabase/admin";
import styles from "./company-commercial.module.css";

export const metadata = { title: "Company seller evidence" };
export const dynamic = "force-dynamic";

type TransferBoundary = {
  id: number;
  purchase_id: number;
  amount_minor: number;
  currency: string;
  movement_reference: string;
  recorded_at: string;
};
type TransferEvidence = { boundary_id: number; provider_transfer_id: string; verified_at: string };
type RecoveryBalance = {
  purchase_id: number;
  booked_minor: number;
  recovered_minor: number;
  outstanding_minor: number;
  currency: string;
};
type CompanyPurchase = { id: number; course_title_snapshot: string; provider_name_snapshot: string; paid_at: string | null };
type CompanySettlementRow = { purchase_id: number; settlement_id: string; provider_reference: string; amount_minor: number; settled_at: string };
type CompanyBankSettlementRow = { settlement_id: string; anchor_purchase_id: number; effective_amount_minor: number; bank_credit_amount_minor: number; currency: string; bank_statement_reference: string; bank_credit_date: string; verified_by: string; recorded_at: string };

const money = (amountMinor: number, currency: string) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency, minimumFractionDigits: 2,
}).format(amountMinor / 100);
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "—";

export default async function CompanySellerEvidencePage() {
  const transferRecordingEnabled = process.env.PAYMENTS_LIVE_COMPANY_TRANSFER_EVIDENCE_RECORDING_ENABLED === "true";
  const recoveryRecordingEnabled = process.env.PAYMENTS_LIVE_COMPANY_RECOVERY_RECEIPT_RECORDING_ENABLED === "true";
  const bankReconciliationEnabled = process.env.PAYMENTS_LIVE_COMPANY_BANK_RECONCILIATION_ENABLED === "true";
  let boundaries: TransferBoundary[] = [];
  let evidence: TransferEvidence[] = [];
  let recoveries: RecoveryBalance[] = [];
  let settlementRows: CompanySettlementRow[] = [];
  let bankSettlementRows: CompanyBankSettlementRow[] = [];
  let purchases = new Map<number, CompanyPurchase>();
  let boundaryReadFailed = false;
  let evidenceSchemaReady = false;
  let recoverySchemaReady = false;
  let settlementSchemaReady = false;
  let bankSettlementSchemaReady = false;
  let purchaseReadFailed = false;

  try {
    const admin = createAdminClient();
    const [boundaryResult, evidenceResult, recoveryResult, settlementResult, bankSettlementResult] = await Promise.all([
      admin.from("learning_company_seller_outflow_boundaries")
        .select("id,purchase_id,amount_minor,currency,movement_reference,recorded_at")
        .eq("boundary_kind", "transferred").order("recorded_at", { ascending: false }).limit(100),
      admin.from("learning_company_seller_transfer_evidence")
        .select("boundary_id,provider_transfer_id,verified_at").limit(500),
      admin.rpc("list_learning_company_seller_recovery_balances"),
      admin.from("learning_company_paystack_settlement_evidence")
        .select("purchase_id,settlement_id,provider_reference,amount_minor,settled_at")
        .order("settled_at", { ascending: false }).limit(500),
      admin.from("learning_company_paystack_bank_settlement_evidence")
        .select("settlement_id,anchor_purchase_id,effective_amount_minor,bank_credit_amount_minor,currency,bank_statement_reference,bank_credit_date,verified_by,recorded_at")
        .order("recorded_at", { ascending: false }).limit(500),
    ]);

    boundaryReadFailed = Boolean(boundaryResult.error);
    evidenceSchemaReady = !evidenceResult.error;
    recoverySchemaReady = !recoveryResult.error && Array.isArray(recoveryResult.data);
    settlementSchemaReady = !settlementResult.error && Array.isArray(settlementResult.data);
    bankSettlementSchemaReady = !bankSettlementResult.error && Array.isArray(bankSettlementResult.data);
    if (!boundaryResult.error && Array.isArray(boundaryResult.data)) boundaries = boundaryResult.data as TransferBoundary[];
    if (!evidenceResult.error && Array.isArray(evidenceResult.data)) evidence = evidenceResult.data as TransferEvidence[];
    if (recoverySchemaReady) recoveries = (recoveryResult.data ?? []) as RecoveryBalance[];
    if (settlementSchemaReady) settlementRows = (settlementResult.data ?? []) as CompanySettlementRow[];
    if (bankSettlementSchemaReady) bankSettlementRows = (bankSettlementResult.data ?? []) as CompanyBankSettlementRow[];

    const purchaseIds = [...new Set([
      ...boundaries.map((item) => item.purchase_id),
      ...recoveries.map((item) => item.purchase_id),
      ...settlementRows.map((item) => item.purchase_id),
    ])];
    if (purchaseIds.length) {
      const purchaseResult = await admin.from("learning_company_paid_course_purchases")
        .select("id,course_title_snapshot,provider_name_snapshot,paid_at").in("id", purchaseIds);
      purchaseReadFailed = Boolean(purchaseResult.error);
      if (!purchaseResult.error && Array.isArray(purchaseResult.data)) {
        purchases = new Map((purchaseResult.data as CompanyPurchase[]).map((item) => [item.id, item]));
      }
    }
  } catch {
    boundaryReadFailed = true;
  }

  const evidenceByBoundary = new Map(evidence.map((item) => [item.boundary_id, item]));
  const pendingTransferCount = boundaries.filter((item) => !evidenceByBoundary.has(item.id)).length;
  return <section className={`${styles.page} admin-page section-shell`}>
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Private finance operations · Learning Admin</p>
      <h1>Company seller evidence</h1>
      <p>Review company-only seller outflow evidence and independently confirmed repayments. This workspace never initiates a transfer, collects a repayment, or deducts from future earnings.</p>
    </header>

    <section className={styles.summary} aria-label="Company evidence summary">
      <article><span>Recent transferred boundaries</span><strong>{boundaryReadFailed ? "—" : boundaries.length}</strong><small>Latest 100 existing outflows</small></article>
      <article><span>Evidence pending in this list</span><strong>{boundaryReadFailed || !evidenceSchemaReady ? "—" : pendingTransferCount}</strong><small>Requires provider verification</small></article>
      <article><span>Open recovery balances</span><strong>{recoverySchemaReady ? recoveries.filter((item) => item.outstanding_minor > 0).length : "—"}</strong><small>Manual admin recovery only</small></article>
    </section>

    {(boundaryReadFailed || !evidenceSchemaReady || !recoverySchemaReady || !settlementSchemaReady || !bankSettlementSchemaReady || purchaseReadFailed) &&
      <aside className={styles.notice} role="status">
        <strong>Some company evidence data is not available yet.</strong>
        <p>This can mean the prepared Supabase migrations have not been applied, or that a read failed. It is not treated as an empty ledger. Keep the recording flags off until the schema and reconciliation checks are confirmed.</p>
      </aside>}

    <section className={styles.section}>
      <header><p className="eyebrow">Live seller outflows</p><h2>Transfer evidence</h2><p>Only records an already-completed Paystack Live transfer after server-side verification of its recipient and exact amount.</p></header>
      {boundaryReadFailed ? <p className="admin-empty-copy">Transferred boundaries could not be loaded safely.</p>
        : boundaries.length === 0 ? <p className="admin-empty-copy">No transferred company seller boundaries are recorded.</p>
          : <div className={styles.list}>{boundaries.map((boundary) => {
            const recordedEvidence = evidenceByBoundary.get(boundary.id);
            const purchase = purchases.get(boundary.purchase_id);
            return <article key={boundary.id}>
              <div className={styles.heading}><div><strong>{purchase?.course_title_snapshot ?? `Company purchase #${boundary.purchase_id}`}</strong><span>{purchase?.provider_name_snapshot ?? "Provider unavailable"} · Paid {date(purchase?.paid_at ?? null)}</span></div><strong>{money(boundary.amount_minor, boundary.currency)}</strong></div>
              <dl><div><dt>Purchase</dt><dd>#{boundary.purchase_id}</dd></div><div><dt>Boundary reference</dt><dd><code>{boundary.movement_reference}</code></dd></div><div><dt>Recorded</dt><dd>{date(boundary.recorded_at)}</dd></div></dl>
              {recordedEvidence
                ? <p className={styles.confirmed}>Verified transfer recorded · Paystack ID {recordedEvidence.provider_transfer_id} · {date(recordedEvidence.verified_at)}</p>
                : !evidenceSchemaReady ? <p className={styles.muted}>Transfer evidence schema is not available.</p>
                  : transferRecordingEnabled ? <CompanyTransferEvidenceControl purchaseId={boundary.purchase_id} transferReference={boundary.movement_reference} actionClassName={styles.action} errorClassName={styles.error} />
                    : <p className={styles.muted}>Recording is disabled. No transfer can be initiated here.</p>}
            </article>;
          })}</div>}
    </section>

    <section className={styles.section}>
      <header><p className="eyebrow">Paystack payout-to-bank reconciliation</p><h2>Settlement batch bank credits</h2><p>One Paystack settlement can contain several charges. Review the batch payout and the matching bank statement line once per settlement, not once per purchase. A recorded match still does not release seller funds.</p></header>
      {!settlementSchemaReady ? <p className="admin-empty-copy">Paystack settlement evidence is unavailable until its schema is applied and verified.</p>
        : settlementRows.length === 0 ? <p className="admin-empty-copy">No verified Live company charges are linked to a Paystack settlement yet.</p>
          : !bankSettlementSchemaReady ? <p className="admin-empty-copy">Bank reconciliation evidence is unavailable until its migration is applied and verified.</p>
            : <div className={styles.list}>{[...new Map(settlementRows.map((row) => [row.settlement_id, row])).values()].map((row) => {
              const batchRows = settlementRows.filter((candidate) => candidate.settlement_id === row.settlement_id);
              const bankRecord = bankSettlementRows.find((candidate) => candidate.settlement_id === row.settlement_id);
              return <article key={row.settlement_id}>
                <div className={styles.heading}><div><strong>Paystack settlement #{row.settlement_id}</strong><span>Settlement date {date(row.settled_at)} · {batchRows.length} linked company charge{batchRows.length === 1 ? "" : "s"}</span></div><strong>{batchRows.length} sale{batchRows.length === 1 ? "" : "s"}</strong></div>
                <dl>{batchRows.map((sale) => <div key={sale.purchase_id}><dt>{purchases.get(sale.purchase_id)?.course_title_snapshot ?? `Purchase #${sale.purchase_id}`} · charge</dt><dd>{money(sale.amount_minor, "NGN")} · <code>{sale.provider_reference}</code></dd></div>)}</dl>
                {bankRecord ? <p className={styles.confirmed}>Bank statement match recorded · {money(bankRecord.bank_credit_amount_minor, bankRecord.currency)} · {date(bankRecord.bank_credit_date)} · reference <code>{bankRecord.bank_statement_reference}</code></p>
                  : bankReconciliationEnabled ? <CompanyBankSettlementEvidenceControl purchaseId={row.purchase_id} settlementId={row.settlement_id} actionClassName={styles.action} errorClassName={styles.error} />
                    : <p className={styles.muted}>Recording is disabled. Independently inspect the Paystack payout and bank statement before any match is recorded.</p>}
              </article>;
            })}</div>}
    </section>

    <section className={styles.section}>
      <header><p className="eyebrow">Post-transfer recovery</p><h2>Confirmed seller repayments</h2><p>Record a repayment only after independently confirming it in the bank/provider statement. No automatic collection or future-earnings deduction is permitted.</p></header>
      {!recoverySchemaReady ? <p className="admin-empty-copy">Recovery balances are unavailable until the prepared receipt migration is applied and verified.</p>
        : recoveries.filter((item) => item.outstanding_minor > 0).length === 0 ? <p className="admin-empty-copy">No outstanding company seller recovery balances.</p>
          : <div className={styles.list}>{recoveries.filter((item) => item.outstanding_minor > 0).map((item) => {
            const purchase = purchases.get(item.purchase_id);
            return <article key={item.purchase_id}>
              <div className={styles.heading}><div><strong>{purchase?.course_title_snapshot ?? `Company purchase #${item.purchase_id}`}</strong><span>{purchase?.provider_name_snapshot ?? "Provider unavailable"} · Purchase #{item.purchase_id}</span></div><strong>{money(item.outstanding_minor, item.currency)} outstanding</strong></div>
              <dl><div><dt>Booked receivable</dt><dd>{money(item.booked_minor, item.currency)}</dd></div><div><dt>Confirmed repayments</dt><dd>{money(item.recovered_minor, item.currency)}</dd></div></dl>
              {recoveryRecordingEnabled ? <CompanyRecoveryReceiptControl purchaseId={item.purchase_id} outstandingMinor={item.outstanding_minor} actionClassName={styles.action} errorClassName={styles.error} />
                : <p className={styles.muted}>Receipt recording is disabled. Confirm repayments outside Growvelt before they are recorded.</p>}
            </article>;
          })}</div>}
    </section>

    <aside className={styles.safety}><strong>Release remains separate and disabled.</strong><p>This page cannot approve or release seller earnings, reserve a payout, submit a Paystack transfer, or change course access. Bank settlement reconciliation and release controls are still prerequisites.</p></aside>
  </section>;
}
