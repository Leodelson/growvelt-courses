import { OperationsNavigation, OperationsSummary, OperationRecords } from "@/app/components/admin/operations-workspace";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import ops from "@/app/components/admin/operations.module.css";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { listDisputeCases, listPaymentOperations, listRefundCaseEvents, listRefundCases } from "@/app/lib/admin/payment-operations";
import { PaymentRecoveryButton } from "@/app/components/admin/payment-recovery-button";
import { PaymentRefundControl } from "@/app/components/admin/payment-refund-control";
import { PaymentActionsMenu } from "@/app/components/admin/payment-actions-menu";
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
  const refundsEnabled = process.env.PAYSTACK_MODE === "live"
    ? process.env.PAYMENTS_LIVE_REFUNDS_ENABLED === "true"
    : process.env.PAYSTACK_MODE === "test" && process.env.PAYMENTS_REFUNDS_ENABLED === "true";
  const actionsEnabled = process.env.VERCEL_ENV !== "preview";
  return <section className={`admin-page section-shell ${ops.page}`}>
    <OperationsNavigation sections={[{id:"payment-search",label:"Find an order"},{id:"payment-records",label:"Order records"}]} />
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Finance operations</p><h1>Payment reconciliation</h1>
      <p>Inspect Growvelt orders, provider events, access state, and reconciliation findings. Recovery always verifies Paystack server-side before changing state.</p>
    </header>
    <OperationsSummary items={[{label:"Orders in this result",value:operations.length,detail:"Latest matching orders · up to 50"},{label:"Paid orders in this result",value:operations.filter(item=>item.order_status==="paid").length,detail:"Order state, not a settlement balance"},{label:"Reconciliation findings",value:operations.reduce((sum,item)=>sum+item.issue_count,0),detail:"Findings attached to these orders"}]} note="Counts describe this loaded result, not all payments. Search the server by reference, learner or course, then filter the returned records below." />
    <form id="payment-search" className="operations-search-form" action="/dashboard/admin/payments">
      <label htmlFor="payment-query">Order, learner, or course</label>
      <div className="operations-search-row"><input id="payment-query" name="q" defaultValue={q} placeholder="GL-… or learner email" /><button className="button button-primary" type="submit">Search</button>{q ? <Link className="button button-secondary" href="/dashboard/admin/payments">Reset</Link> : null}</div>
    </form>
    <div id="payment-records" className="admin-application-list">{operations.length ? <OperationRecords searchLabel="Filter loaded orders by reference, learner or course" items={operations.map((item) => ({id:String(item.order_id),title:item.course_title,group:item.order_status,keywords:`${item.order_reference} ${item.learner_email??""} ${item.attempt_status??""} ${item.event_status??""} ${item.recovery_status??""}`,content:
      <article className="admin-application-row" key={item.order_id}>
        <div><p className="admin-status">{item.order_status} · {item.attempt_status ?? "no attempt status"}</p><h2>{item.course_title}</h2><p>{item.learner_email ?? "Detached learner"}</p>
          <div className="admin-course-meta"><span>{item.currency} {(item.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span><span>{item.event_status ?? "No event"}</span><span>{item.recovery_status ?? "No recovery state"}</span><span>{item.issue_count} reconciliation issue{item.issue_count === 1 ? "" : "s"}</span></div><code>{item.order_reference}</code>
        </div>
        <div className="admin-row-meta">
          <time dateTime={item.created_at}>{reviewDate(item.created_at, "en", undefined, true)}</time>
          <PaymentActionsMenu orderReference={item.order_reference}>
            <div className="payment-actions-panel">
              <PaymentRecoveryButton reference={item.order_reference} actionsEnabled={actionsEnabled} />
              <PaymentRefundControl
                reference={item.order_reference}
                orderStatus={item.order_status}
                enabled={refundsEnabled}
                refundEligible={item.refundEligibleInCurrentMode}
                actionsEnabled={actionsEnabled}
                existingCase={refundByOrder.has(item.order_id) ? {
                  caseId: refundByOrder.get(item.order_id)!.case_id,
                  status: refundByOrder.get(item.order_id)!.status,
                  providerStatus: refundByOrder.get(item.order_id)!.provider_status,
                  providerCaseId: refundByOrder.get(item.order_id)!.provider_case_id,
                  providerReference: refundByOrder.get(item.order_id)!.provider_case_reference,
                  events: refundEventsByCase.get(refundByOrder.get(item.order_id)!.case_id) ?? [],
                } : undefined}
              />
            </div>
          </PaymentActionsMenu>
          {disputeByOrder.has(item.order_id) ? <PaymentDisputeSummary dispute={{
            caseId: disputeByOrder.get(item.order_id)!.case_id,
            status: disputeByOrder.get(item.order_id)!.status,
            amountMinor: disputeByOrder.get(item.order_id)!.amount_minor,
            currency: disputeByOrder.get(item.order_id)!.currency,
            providerCaseId: disputeByOrder.get(item.order_id)!.provider_case_id,
            providerStatus: disputeByOrder.get(item.order_id)!.provider_status,
            resolution: disputeByOrder.get(item.order_id)!.provider_resolution,
            category: disputeByOrder.get(item.order_id)!.dispute_category,
            reason: disputeByOrder.get(item.order_id)!.dispute_reason,
            deadline: disputeByOrder.get(item.order_id)!.response_deadline_at,
            events: refundEvents.filter((event) => event.payment_case_id === disputeByOrder.get(item.order_id)!.case_id),
          }} /> : null}
        </div>
      </article>}))} />
      : <section className="admin-empty-state"><p className="eyebrow">No matching orders</p><h2>No payment operations found.</h2><p>Try another Growvelt reference, learner email, or course title.</p></section>}</div>
  </section>;
}
