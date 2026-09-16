import { redirect } from "next/navigation";
import { getOwnInstructorEarnings } from "@/app/lib/instructor/earnings";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";

export const metadata = { title: "Instructor earnings" };

const money = (amountMinor: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value)) : "—";

const statusCopy = {
  held: "Held — within the 14-day protection period.",
  available: "Available — eligible for a future payout. Instructor payouts are not currently enabled.",
  reserved: "Reserved — temporarily protected from payout.",
  paid: "Paid — payout records will be available in a later phase.",
  reversed: "Reversed — the related sale was financially reversed.",
  recoverable: "Recoverable — subject to recovery before future payouts.",
} as const;

export default async function InstructorEarningsPage() {
  if (!await isApprovedInstructor()) redirect("/teach/application");
  const { earnings, events } = await getOwnInstructorEarnings();
  const totals = earnings.reduce<Record<keyof typeof statusCopy, number>>((result, earning) => ({ ...result, [earning.earning_status]: result[earning.earning_status] + earning.instructor_gross_minor }), { held: 0, available: 0, reserved: 0, paid: 0, reversed: 0, recoverable: 0 });
  const eventsByEarning = new Map(earnings.map((earning) => [earning.earning_id, events.filter((event) => event.earning_id === earning.earning_id)]));

  return <section className="instructor-earnings-page section-shell">
    <header className="instructor-earnings-hero">
      <p className="eyebrow">Instructor commercial earnings</p><h1>Understand your course earnings.</h1>
      <p>Your earnings are calculated from verified course sales. Available earnings are eligible for a future payout; instructor payouts are not currently enabled.</p>
    </header>
    <section className="instructor-earnings-summary" aria-label="Instructor earnings summary">
      {(["held", "available", "reversed", "recoverable"] as const).map((status) => <article key={status}><span>{status[0].toUpperCase() + status.slice(1)}</span><strong>{money(totals[status])}</strong><small>{statusCopy[status]}</small></article>)}
    </section>
    <section className="instructor-earnings-history" aria-labelledby="earnings-history-title">
      <header><div><p className="eyebrow">Immutable history</p><h2 id="earnings-history-title">Commercial allocation history</h2></div><p>Each entry shows the verified sale allocation and its current earnings state. Payouts are not available in this phase.</p></header>
      {earnings.length ? <div className="instructor-earnings-list">{earnings.map((earning) => <article key={earning.earning_id}>
        <div className="instructor-earnings-heading"><div><p className={`instructor-earning-status is-${earning.earning_status}`}>{earning.earning_status}</p><h3>{earning.course_title}</h3><code>{earning.order_reference}</code></div><strong>{money(earning.instructor_gross_minor, earning.currency)}</strong></div>
        <dl><div><dt>Gross sale</dt><dd>{money(earning.gross_amount_minor, earning.currency)}</dd></div><div><dt>Growvelt allocation</dt><dd>{money(earning.platform_commission_minor, earning.currency)}</dd></div><div><dt>Instructor allocation</dt><dd>{money(earning.instructor_gross_minor, earning.currency)}</dd></div><div><dt>Terms</dt><dd>{earning.commercial_terms_version}</dd></div><div><dt>Available from</dt><dd>{date(earning.available_at)}</dd></div><div><dt>Released</dt><dd>{date(earning.released_at)}</dd></div></dl>
        <p className="instructor-earnings-explanation">{statusCopy[earning.earning_status]}{earning.hold_reason ? ` ${earning.hold_reason}` : ""}</p>
        {earning.recoverable_amount_minor > 0 ? <p className="instructor-earnings-recoverable">Recoverable amount: {money(earning.recoverable_amount_minor, earning.currency)}</p> : null}
        {eventsByEarning.get(earning.earning_id)?.length ? <ol className="instructor-earning-events">{eventsByEarning.get(earning.earning_id)!.map((event) => <li key={event.event_id}><strong>{event.event_type}</strong><span>{event.from_status ?? "—"} → {event.to_status ?? "—"}</span><time dateTime={event.occurred_at}>{date(event.occurred_at)}</time></li>)}</ol> : null}
      </article>)}</div> : <div className="instructor-earnings-empty"><p className="eyebrow">No earnings yet</p><h2>Verified paid sales will appear here.</h2><p>When a paid course sale is commercially allocated, this page will show its 14-day hold and future availability status.</p></div>}
    </section>
  </section>;
}
