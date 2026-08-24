import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";

type PaymentStatus = { order_status: string; payment_status: string; course_slug: string | null; entitlement_active: boolean };
export const metadata = { title: "Payment status" };
export const dynamic = "force-dynamic";

export default async function PaystackCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const reference = (await searchParams).reference ?? "";
  const validReference = /^GL-[A-F0-9]{32}$/.test(reference);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user && validReference ? await supabase.rpc("get_own_paystack_learning_payment_status", { p_order_reference: reference }) : { data: null };
  const status = (data as PaymentStatus[] | null)?.[0];
  const complete = status?.order_status === "paid" && status.entitlement_active;
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">PAYSTACK TEST MODE</p><h1>{complete ? "Course access is ready." : "We’re confirming your payment."}</h1>
    <p>{!user ? "Sign in to view this payment status." : complete ? "Growvelt verified the test payment and added the course to My Learning." : status ? "The browser return does not prove payment. Access appears only after the verified Paystack webhook is processed." : "We couldn’t find this payment for the signed-in account."}</p>
    <div className="auth-actions">
      {!user ? <Link className="button button-primary" href={`/sign-in?next=${encodeURIComponent(`/payments/paystack/callback?reference=${reference}`)}`}>Sign in</Link> : complete && status?.course_slug ? <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(status.course_slug)}`}>Open course</Link> : <Link className="button button-primary" href={`/payments/paystack/callback?reference=${encodeURIComponent(reference)}`}>Check again</Link>}
      <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link>
    </div>
  </section></main>;
}
