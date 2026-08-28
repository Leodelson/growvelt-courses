import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { listDisputeCases, listPaymentOperations, listRefundCaseEvents, listRefundCases } from "@/app/lib/admin/payment-operations";
import { PaymentRecoveryButton } from "@/app/components/admin/payment-recovery-button";
import { PaymentRefundControl } from "@/app/components/admin/payment-refund-control";
import { PaymentDisputeSummary } from "@/app/components/admin/payment-dispute-summary";

export const metadata = { title: "Payment operations" };

export default async function PaymentOperationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [operations, refundCases, refundEvents, disputeCases] = await Promise.all([listPaymentOperations(user.id, q), listRefundCases(user.id), listRefundCaseEvents(user.id),listDisputeCases(user.id)]);
  const refundByOrder = new Map(refundCases.map((item) => [item.order_id, item]));
  const refundEventsByCase = new Map(refundCases.map((item) => [item.case_id, refundEvents.filter((event) => event.payment_case_id === item.case_id)]));
  const disputeByOrder=new Map(disputeCases.map(item=>[item.order_id,item]));
  const refundsEnabled = process.env.PAYSTACK_MODE === "test" && process.env.PAYMENTS_REFUNDS_ENABLED === "true";
  return <section className="admin-page section-shell">
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Finance operations</p><h1>Payment reconciliation</h1>
      <p>Inspect Growvelt Learning orders, provider events, access state, and reconciliation findings. Recovery always verifies Paystack server-side before changing state.</p>
    </header>
    <form className="operations-search-form" action="/dashboard/admin/payments">
      <label htmlFor="payment-query">Order, learner, or course</label>
      <div className="operations-search-row"><input id="payment-query" name="q" defaultValue={q} placeholder="GL-… or learner email" /><button className="button button-primary" type="submit">Search</button>{q ? <Link className="button button-secondary" href="/dashboard/admin/payments">Clear</Link> : null}</div>
    </form>
    {operations.length ? <div className="admin-application-list">{operations.map((item) =>
      <article className="admin-application-row" key={item.order_id}>
        <div><p className="admin-status">{item.order_status} · {item.attempt_status ?? "no attempt status"}</p><h2>{item.course_title}</h2><p>{item.learner_email ?? "Detached learner"}</p>
          <div className="admin-course-meta"><span>{item.currency} {(item.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span><span>{item.event_status ?? "No event"}</span><span>{item.recovery_status ?? "No recovery state"}</span><span>{item.issue_count} reconciliation issue{item.issue_count === 1 ? "" : "s"}</span></div><code>{item.order_reference}</code>
        </div>
        <div className="admin-row-meta"><time dateTime={item.created_at}>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time><PaymentRecoveryButton reference={item.order_reference} /><PaymentRefundControl reference={item.order_reference} orderStatus={item.order_status} enabled={refundsEnabled} existingCase={refundByOrder.has(item.order_id) ? { caseId: refundByOrder.get(item.order_id)!.case_id, status: refundByOrder.get(item.order_id)!.status, providerStatus: refundByOrder.get(item.order_id)!.provider_status, providerCaseId: refundByOrder.get(item.order_id)!.provider_case_id, providerReference: refundByOrder.get(item.order_id)!.provider_case_reference, events: refundEventsByCase.get(refundByOrder.get(item.order_id)!.case_id) ?? [] } : undefined} />{disputeByOrder.has(item.order_id)?<PaymentDisputeSummary dispute={{caseId:disputeByOrder.get(item.order_id)!.case_id,status:disputeByOrder.get(item.order_id)!.status,amountMinor:disputeByOrder.get(item.order_id)!.amount_minor,currency:disputeByOrder.get(item.order_id)!.currency,providerCaseId:disputeByOrder.get(item.order_id)!.provider_case_id,providerStatus:disputeByOrder.get(item.order_id)!.provider_status,resolution:disputeByOrder.get(item.order_id)!.provider_resolution,category:disputeByOrder.get(item.order_id)!.dispute_category,reason:disputeByOrder.get(item.order_id)!.dispute_reason,deadline:disputeByOrder.get(item.order_id)!.response_deadline_at,events:refundEvents.filter(event=>event.payment_case_id===disputeByOrder.get(item.order_id)!.case_id)}}/>:null}</div>
      </article>)}</div>
      : <section className="admin-empty-state"><p className="eyebrow">No matching orders</p><h2>No payment operations found.</h2><p>Try another Growvelt reference, learner email, or course title.</p></section>}
  </section>;
}
