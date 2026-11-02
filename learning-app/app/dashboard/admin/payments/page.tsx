import { OperationsNavigation, OperationsSummary, OperationRecords } from "@/app/components/admin/operations-workspace";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import ops from "@/app/components/admin/operations.module.css";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";
import { listDisputeCases, listLiveSubscriptionRefundCaseEvents, listLiveSubscriptionRefundOperations, listPaymentOperations, listRefundCaseEvents, listRefundCases } from "@/app/lib/admin/payment-operations";
import { PaymentRecoveryButton } from "@/app/components/admin/payment-recovery-button";
import { PaymentRefundControl } from "@/app/components/admin/payment-refund-control";
import { PaymentActionsMenu } from "@/app/components/admin/payment-actions-menu";
import { PaymentDisputeSummary } from "@/app/components/admin/payment-dispute-summary";
import { SubscriptionRefundControl } from "@/app/components/admin/subscription-refund-control";

export const metadata = { title: "Payment operations" };

export default async function PaymentOperationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const liveMode = process.env.PAYSTACK_MODE === "live";
  const [operations, refundCases, refundEvents, disputeCases, subscriptionOperations] = await Promise.all([
    listPaymentOperations(user.id, q), listRefundCases(user.id), listRefundCaseEvents(user.id), listDisputeCases(user.id),
    liveMode ? listLiveSubscriptionRefundOperations(user.id, q) : Promise.resolve([]),
  ]);
  const subscriptionCaseIds = subscriptionOperations.flatMap(item => item.refund_case_id ? [item.refund_case_id] : []);
  const subscriptionRefundEvents = subscriptionCaseIds.length
    ? await listLiveSubscriptionRefundCaseEvents(user.id, subscriptionCaseIds)
    : [];
  const refundByOrder = new Map(refundCases.map((item) => [item.order_id, item]));
  const refundEventsByCase = new Map(refundCases.map((item) => [item.case_id, refundEvents.filter((event) => event.payment_case_id === item.case_id)]));
  const disputeByOrder=new Map(disputeCases.map(item=>[item.order_id,item]));
  const refundsEnabled = process.env.PAYSTACK_MODE === "live"
    ? process.env.PAYMENTS_LIVE_REFUNDS_ENABLED === "true"
    : process.env.PAYSTACK_MODE === "test" && process.env.PAYMENTS_REFUNDS_ENABLED === "true";
  const subscriptionRefundsEnabled = liveMode && refundsEnabled
    && process.env.GROWVELT_LEARNING_LIVE_SUBSCRIPTION_REFUNDS_ENABLED === "true";
  const actionsEnabled = process.env.VERCEL_ENV !== "preview";
  return <section className={`admin-page section-shell ${ops.page}`}>
    <OperationsNavigation sections={[{id:"payment-search",label:"Find a payment"},{id:"payment-records",label:"Course orders"},...(liveMode ? [{id:"subscription-records",label:"Subscription invoices"}] : [])]} />
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Finance operations</p><h1>Payment reconciliation</h1>
      <p>Inspect Growvelt course orders and subscription invoices, provider events, access state, and reconciliation findings. Refund recovery verifies provider evidence before changing financial or access state.</p>
    </header>
    <OperationsSummary items={[{label:"Orders in this result",value:operations.length,detail:"Latest matching orders · up to 50"},{label:"Paid orders in this result",value:operations.filter(item=>item.order_status==="paid").length,detail:"Order state, not a settlement balance"},{label:"Reconciliation findings",value:operations.reduce((sum,item)=>sum+item.issue_count,0),detail:"Findings attached to these orders"}]} note="Counts describe this loaded result, not all payments. Search the server by reference, learner or course, then filter the returned records below." />
    <form id="payment-search" className="operations-search-form" action="/dashboard/admin/payments">
      <label htmlFor="payment-query">Order, subscription invoice, learner, or course</label>
      <div className="operations-search-row"><input id="payment-query" name="q" defaultValue={q} placeholder="Growvelt reference or learner email" /><button className="button button-primary" type="submit">Search</button>{q ? <Link className="button button-secondary" href="/dashboard/admin/payments">Reset</Link> : null}</div>
    </form>
    <div id="payment-records" className="admin-application-list">{operations.length ? <OperationRecords searchLabel="Filter loaded orders by reference, learner or course" items={operations.map((item) => ({id:String(item.order_id),title:item.course_title,group:item.order_status,keywords:`${item.order_reference} ${item.learner_email??""} ${item.attempt_status??""} ${item.event_status??""} ${item.recovery_status??""}`,content:
      <article className="admin-application-row" key={item.order_id}>
        <div><p className="admin-status">{item.order_status} · {item.attempt_status ?? "no attempt status"}</p><h2>{item.course_title}</h2><p>{item.learner_email ?? "Detached learner"}</p>
          <div className="admin-course-meta"><span>{item.currency} {(item.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span><span>{item.event_status ?? "No event"}</span><span>{item.recovery_status ?? "No recovery state"}</span><span>{item.issue_count} reconciliation issue{item.issue_count === 1 ? "" : "s"}</span></div><code>{item.order_reference}</code>
        </div>
        <div className="admin-row-meta">
          <time dateTime={item.created_at}>{reviewDate(item.created_at, "en", undefined, true)}</time>
          <PaymentActionsMenu orderReference={item.order_reference}>
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
    {liveMode ? <div id="subscription-records" className="admin-application-list">
      <header className="admin-page-header"><p className="eyebrow">Recurring payments</p><h2>Live subscription invoices</h2><p>Subscription refunds use a separate invoice-level case. A provider response alone does not remove access or reverse an instructor allocation.</p></header>
      {!subscriptionRefundsEnabled ? <p className="payment-action-note">Live subscription refund initiation is disabled. Existing invoice records remain visible for review.</p> : null}
      {subscriptionOperations.length ? <OperationRecords searchLabel="Filter loaded Live subscription invoices by reference, learner, or plan" items={subscriptionOperations.map(item => {
        const invoiceEvents = item.refund_case_id
          ? subscriptionRefundEvents.filter(event => event.refund_case_id === item.refund_case_id)
          : [];
        return {
          id: item.invoice_id,
          title: item.plan_name,
          group: item.refund_status ?? item.invoice_status,
          keywords: `${item.invoice_reference} ${item.provider_transaction_reference} ${item.learner_email ?? ""} ${item.plan_name} ${item.refund_provider_status ?? ""}`,
          content: <article className="admin-application-row" key={item.invoice_id}>
            <div><p className="admin-status">Live subscription · {item.invoice_status.replaceAll("_", " ")}{item.refund_status ? ` · refund ${item.refund_status.replaceAll("_", " ")}` : ""}</p><h2>{item.plan_name}</h2><p>{item.learner_email ?? "Detached learner"}</p>
              <div className="admin-course-meta"><span>{item.currency} {(item.amount_minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span><span>{item.refund_provider_status ?? "No refund event"}</span><span>{item.refund_case_id ? "Refund case recorded" : "No refund case"}</span></div><code>{item.invoice_reference}</code>
            </div>
            <div className="admin-row-meta">
              <time dateTime={item.paid_at ?? item.created_at}>{reviewDate(item.paid_at ?? item.created_at, "en", undefined, true)}</time>
              <PaymentActionsMenu orderReference={item.invoice_reference} entityLabel="subscription invoice">
                <SubscriptionRefundControl
                  invoiceReference={item.invoice_reference}
                  invoiceStatus={item.invoice_status}
                  enabled={subscriptionRefundsEnabled}
                  actionsEnabled={actionsEnabled}
                  existingCase={item.refund_case_id && item.refund_case_reference && item.refund_status ? {
                    caseId: item.refund_case_id,
                    caseReference: item.refund_case_reference,
                    status: item.refund_status,
                    providerStatus: item.refund_provider_status,
                    providerCaseId: item.refund_provider_case_id,
                    providerReference: item.refund_provider_case_reference,
                    events: invoiceEvents,
                  } : undefined}
                />
              </PaymentActionsMenu>
            </div>
          </article>,
        };
      })} />
        : <section className="admin-empty-state"><p className="eyebrow">No Live subscription invoices</p><h3>No matching subscription invoices found.</h3><p>Invoices appear here only after a Live subscription charge has been recorded.</p></section>}
    </div> : null}
  </section>;
}
