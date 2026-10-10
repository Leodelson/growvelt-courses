import Link from "next/link";
import { CompanyPaymentReturnCheck } from "@/app/components/company/payment-return-check";
import { LearnerPaymentReturnCheck } from "@/app/components/payments/learner-payment-return-check";
import { getCompanyPaymentForManager } from "@/app/lib/company/payment-status";
import { resolvePaystackCallbackReference, type PaystackCallbackSearchParams } from "@/app/lib/payments/paystack-callback";
import { createClient } from "@/app/lib/supabase/server";

type PaymentStatus = { order_status: string; payment_status: string; course_slug: string | null; entitlement_active: boolean };
export const metadata = { title: "Payment status" };
export const dynamic = "force-dynamic";

export default async function PaystackCallbackPage({ searchParams }: { searchParams: Promise<PaystackCallbackSearchParams> }) {
  const reference = resolvePaystackCallbackReference(await searchParams);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (reference?.startsWith("CP-")) {
    const purchase = user ? await getCompanyPaymentForManager(reference, user.id) : null;
    const complete = purchase?.status === "paid";
    return <main className="payment-callback-page"><section className="auth-card payment-callback-card">
      <p className="eyebrow">PAYMENT STATUS</p>
      <h1>{complete ? "Company course purchase confirmed." : "We’re confirming your company payment."}</h1>
      <p>{!user ? "Sign in to view this company payment." : !purchase ? "This company payment is not available to your account." : complete ? `${purchase.seatCount} employee${purchase.seatCount === 1 ? "" : "s"} now have access to ${purchase.courseTitle}.` : "Your payment is being checked against Paystack. Please do not pay again."}</p>
      {user && purchase && !complete && <CompanyPaymentReturnCheck reference={reference} />}
      <div className="auth-actions">
        {!user ? <Link className="button button-primary" href={`/sign-in?next=${encodeURIComponent(`/payments/paystack/callback?reference=${reference}`)}`}>Sign in</Link> : null}
        <Link className="button button-secondary" href="/dashboard/company">Company learning</Link>
      </div>
    </section></main>;
  }
  const { data } = user && reference ? await supabase.rpc("get_own_paystack_learning_payment_status", { p_order_reference: reference }) : { data: null };
  const status = (data as PaymentStatus[] | null)?.[0];
  const complete = status?.order_status === "paid" && status.entitlement_active;
  return <main className="payment-callback-page"><section className="auth-card payment-callback-card">
    <p className="eyebrow">PAYMENT STATUS</p><h1>{complete ? "Course access is ready." : "We’re confirming your payment."}</h1>
    <p>{!user ? "Sign in to view this payment status." : complete ? "Growvelt verified the payment and added the course to My Learning." : status ? "We’ll keep checking for Paystack’s verified confirmation. Your course will appear in My Learning once it’s confirmed." : "We couldn’t find this payment for the signed-in account."}</p>
    {user && status && !complete && reference ? <LearnerPaymentReturnCheck key={reference} complete={complete} reference={reference} /> : null}
    <div className="auth-actions">
      {!user ? <Link className="button button-primary" href={`/sign-in?next=${encodeURIComponent(reference ? `/payments/paystack/callback?reference=${reference}` : "/payments/paystack/callback")}`}>Sign in</Link> : complete && status?.course_slug ? <Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(status.course_slug)}`}>Open course</Link> : null}
      {user && (!status || complete) ? <Link className="button button-secondary" href="/dashboard/my-learning">My Learning</Link> : null}
    </div>
  </section></main>;
}
