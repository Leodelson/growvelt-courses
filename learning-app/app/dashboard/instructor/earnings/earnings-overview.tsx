import Link from "next/link";
import { ReviewCollection } from "@/app/components/admin/review-collection";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import styles from "./earnings.module.css";
import type { InstructorEarning, InstructorEarningEvent } from "@/app/lib/instructor/earnings";

const money = (amountMinor: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
const date = (value: string | null) => reviewDate(value,"en");

const statusCopy = {
  held: "Held within the 14-day protection period.",
  available: "Eligible for a future payout. Instructor payouts are not currently enabled.",
  reserved: "Reserved and protected from another payout reservation.",
  paid: "Recorded as paid. Review the recorded history for this allocation.",
  reversed: "The related sale was financially reversed.",
  recoverable: "Requires financial reconciliation. This page cannot collect or deduct funds.",
} as const;

export function EarningsOverview({earnings,events}:{earnings:InstructorEarning[];events:InstructorEarningEvent[]}) {
  const totals = earnings.reduce<Record<keyof typeof statusCopy, number>>((result, earning) => ({ ...result, [earning.earning_status]: result[earning.earning_status] + earning.instructor_gross_minor }), { held: 0, available: 0, reserved: 0, paid: 0, reversed: 0, recoverable: 0 });
  const eventsByEarning = new Map(earnings.map((earning) => [earning.earning_id, events.filter((event) => event.earning_id === earning.earning_id)]));

  return <section className={`instructor-earnings-page section-shell ${styles.page}`}>
    <Link className={styles.back} href="/dashboard/instructor">← Back to instructor workspace</Link>
    <header className="instructor-earnings-hero">
      <p className="eyebrow">Instructor commercial earnings</p><h1>Understand your course earnings.</h1>
      <p>Your earnings are calculated from verified course sales. Available earnings are eligible for a future payout; instructor payouts are not currently enabled.</p>
    </header>
    <nav className={styles.navigation} aria-label="Earnings sections"><a href="#earnings-summary">Allocation summary</a><a href="#earnings-history">Earnings history</a><a href="#earnings-guide">Status guide</a><Link href="/dashboard/instructor/payout-profile">Payout profile</Link></nav>
    <section id="earnings-summary" className="instructor-earnings-summary" aria-label="Instructor earnings summary">
      {(Object.keys(statusCopy) as (keyof typeof statusCopy)[]).map((status) => <article key={status}><span>{status[0].toUpperCase() + status.slice(1)}</span><strong>{money(totals[status])}</strong><small>{statusCopy[status]}</small></article>)}
    </section>
    <p className={styles.scope}>Amounts group the loaded instructor allocations by recorded state. They are not a withdrawable balance or a bank settlement. The recoverable total is the allocation amount, not the outstanding recovery amount shown on each entry.</p>
    <details id="earnings-guide" className={styles.guide}><summary>How to read your earnings</summary><div><p>Verified paid sales create commercial allocations. Held earnings remain in the protection period; an eligible release can move them to available. Availability does not initiate a payout.</p><p>Reserved, paid, reversed and recoverable describe separate financial states. Review the order reference, terms and recorded events below when investigating an entry. A refund or financial reversal can affect an allocation after the original sale.</p><p>The payout-profile page manages recipient details separately. This page has no withdrawal, transfer or recovery-collection control.</p></div></details>
    <section id="earnings-history" className="instructor-earnings-history" aria-labelledby="earnings-history-title">
      <header><div><p className="eyebrow">Immutable history</p><h2 id="earnings-history-title">Commercial allocation history</h2></div><p>Each entry shows the verified sale allocation and its current earnings state. Payouts are not available in this phase.</p></header>
      {earnings.length ? <div className="instructor-earnings-list"><ReviewCollection searchLabel="Find earnings by course, order reference or terms" groupLabel="Earnings status" allGroupsLabel="All statuses" groups={Object.fromEntries(Object.keys(statusCopy).map(status=>[status,status[0].toUpperCase()+status.slice(1)]))} items={earnings.map((earning) => ({id:String(earning.earning_id),title:earning.course_title,group:earning.earning_status,keywords:`${earning.order_reference} ${earning.commercial_terms_version}`,content:<article>
        <div className="instructor-earnings-heading"><div><p className={`instructor-earning-status is-${earning.earning_status}`}>{earning.earning_status}</p><h3>{earning.course_title}</h3><code>{earning.order_reference}</code></div><strong>{money(earning.instructor_gross_minor, earning.currency)}</strong></div>
        <dl><div><dt>Gross sale</dt><dd>{money(earning.gross_amount_minor, earning.currency)}</dd></div><div><dt>Growvelt allocation</dt><dd>{money(earning.platform_commission_minor, earning.currency)}</dd></div><div><dt>Instructor allocation</dt><dd>{money(earning.instructor_gross_minor, earning.currency)}</dd></div><div><dt>Terms</dt><dd>{earning.commercial_terms_version}</dd></div><div><dt>Available from</dt><dd>{date(earning.available_at)}</dd></div><div><dt>Released</dt><dd>{date(earning.released_at)}</dd></div></dl>
        <p className="instructor-earnings-explanation">{statusCopy[earning.earning_status]}{earning.hold_reason ? ` ${earning.hold_reason}` : ""}</p>
        {earning.recoverable_amount_minor > 0 ? <p className="instructor-earnings-recoverable">Recoverable amount: {money(earning.recoverable_amount_minor, earning.currency)}</p> : null}
        {eventsByEarning.get(earning.earning_id)?.length ? <details className={styles.timeline}><summary>Recorded events ({eventsByEarning.get(earning.earning_id)!.length})</summary><ol className="instructor-earning-events">{eventsByEarning.get(earning.earning_id)!.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_status ?? ", "} → {event.to_status ?? ", "}</span><time dateTime={event.occurred_at}>{date(event.occurred_at)}</time></li>)}</ol></details> : <p className={styles.scope}>No events were returned for this allocation.</p>}
      </article>}))} /></div> : <div className="instructor-earnings-empty"><p className="eyebrow">No earnings yet</p><h2>Verified paid sales will appear here.</h2><p>When a paid course sale is commercially allocated, this page will show its 14-day hold and future availability status.</p></div>}
    </section>
  </section>;
}
