import { listCommercialOperations } from "@/app/lib/admin/commercial-operations";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Commercial earnings review" };
const money = (amountMinor: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value)) : "—";

export default async function AdminCommercialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const operations = await listCommercialOperations(user.id);
  const issues = operations.reduce((total, item) => total + item.reconciliation_issue_count, 0);
  return <section className="admin-page commercial-operations-page section-shell">
    <header className="admin-page-header admin-review-hero"><p className="eyebrow">Commercial operations</p><h1>Instructor earnings review</h1><p>Read-only visibility into authoritative commercial allocations and earnings. Payouts, transfers, and withholding deductions are not enabled.</p></header>
    <section className="commercial-operations-summary"><article><span>Commercial earnings</span><strong>{operations.length}</strong><small>Verified allocation records</small></article><article><span>Reconciliation findings</span><strong>{issues}</strong><small>From the authoritative commercial reconciliation</small></article></section>
    {operations.length ? <div className="commercial-operations-list">{operations.map((item) => <article key={item.earning_id}>
      <div className="commercial-operation-heading"><div><p className={`admin-status is-${item.earning_status}`}>{item.earning_status} · {item.allocation_status}</p><h2>{item.course_title}</h2><p>{item.instructor_name ?? "Instructor"} · {item.instructor_email ?? "Email unavailable"}</p><code>{item.order_reference}</code></div><strong>{money(item.instructor_gross_minor, item.currency)}</strong></div>
      <dl><div><dt>Gross sale</dt><dd>{money(item.gross_amount_minor, item.currency)}</dd></div><div><dt>Growvelt share</dt><dd>{money(item.platform_commission_minor, item.currency)}</dd></div><div><dt>Instructor share</dt><dd>{money(item.instructor_gross_minor, item.currency)}</dd></div><div><dt>Available from</dt><dd>{date(item.available_at)}</dd></div><div><dt>Released</dt><dd>{date(item.released_at)}</dd></div><div><dt>Terms</dt><dd>{item.commercial_terms_version}</dd></div></dl>
      <div className="commercial-operation-foot"><span>Recoverable: {money(item.recoverable_amount_minor, item.currency)}</span><span>Reversal case: {item.reversal_case_id ?? "—"}</span><span>{item.reconciliation_issue_count} reconciliation issue{item.reconciliation_issue_count === 1 ? "" : "s"}</span></div>
      {item.reconciliation_details.length ? <ul className="commercial-operation-issues">{item.reconciliation_details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
    </article>)}</div> : <section className="admin-empty-state"><p className="eyebrow">No commercial earnings</p><h2>No allocations exist yet.</h2><p>Phase 1C1 intentionally did not backfill historical orders. Future verified paid sales will appear here after commercial allocation.</p></section>}
  </section>;
}
