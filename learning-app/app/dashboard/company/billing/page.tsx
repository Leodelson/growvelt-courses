import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompanyManagement, getOwnCompanyWorkspaces } from "@/app/lib/company/workspaces";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import "./billing.css";

export const metadata = { title: "Company billing" };
export const dynamic = "force-dynamic";

type PaymentAttempt = {
  purchase_id: number;
  provider_reference: string;
  status: string;
  created_at: string;
};

function formatNaira(amountMinor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amountMinor / 100);
}

export default async function CompanyBillingPage() {
  const supabase = await createClient();
  if (!(await supabase.auth.getUser()).data.user) redirect("/sign-in?next=%2Fdashboard%2Fcompany%2Fbilling");

  const workspaces = (await getOwnCompanyWorkspaces()).filter((workspace) =>
    workspace.workspace_status === "active" && workspace.membership_status === "active" &&
    (workspace.membership_role === "owner" || workspace.membership_role === "admin"),
  );
  const records = await Promise.all(workspaces.map(async (workspace) => ({
    workspace,
    purchases: (await getCompanyManagement(workspace)).paidPurchases,
  })));
  const purchaseIds = records.flatMap(({ purchases }) => purchases.map((purchase) => purchase.purchase_id));
  let attempts: PaymentAttempt[] = [];
  if (purchaseIds.length) {
    // The manager-scoped RPC above establishes authorization before this
    // server-only lookup. Never expose attempts for arbitrary purchase IDs.
    const { data, error } = await createAdminClient()
      .from("learning_company_paid_course_purchase_attempts")
      .select("purchase_id,provider_reference,status,created_at")
      .in("purchase_id", purchaseIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Unable to load company billing references.");
    attempts = (data ?? []) as PaymentAttempt[];
  }
  const referenceByPurchase = new Map<number, string>();
  for (const attempt of attempts) {
    if (attempt.status === "succeeded") referenceByPurchase.set(attempt.purchase_id, attempt.provider_reference);
    else if (!referenceByPurchase.has(attempt.purchase_id)) referenceByPurchase.set(attempt.purchase_id, attempt.provider_reference);
  }

  return <section className="instructor-earnings-page section-shell company-billing-page">
    <header className="instructor-earnings-hero">
      <Link className="text-button" href="/dashboard/company">← Company learning</Link>
      <p className="eyebrow">Private company billing</p>
      <h1>Paid course purchases</h1>
      <p>Only active company owners and admins can see these company-sponsored purchases. Personal courses and earnings are never included.</p>
    </header>
    {records.length === 0 && <section className="organization-panel"><p>No company billing workspace is available to this account.</p></section>}
    {records.map(({ workspace, purchases }) => <section className="organization-panel" key={workspace.workspace_id}>
      <header><p className="eyebrow">Company billing</p><h2>{workspace.name}</h2><p>One purchase covers the selected employee seats for one course. This summary is not a tax invoice or Paystack receipt.</p></header>
      {purchases.length === 0 ? <p>No paid-course purchases yet.</p> : <div className="company-billing-records">
        {purchases.map((purchase) => <article className="company-billing-record" key={purchase.purchase_id}>
          <div className="company-billing-record-heading"><div><h3>{purchase.course_title}</h3><p>{purchase.provider_name}</p></div><span className="company-assignment-progress">{purchase.status === "checkout_ready" ? "Checkout ready" : purchase.status === "checkout_pending" ? "Awaiting confirmation" : purchase.status}</span></div>
          <dl>
            <div><dt>Employee seats</dt><dd>{purchase.seat_count}</dd></div>
            <div><dt>Course price per seat</dt><dd>{formatNaira(purchase.unit_amount_minor)}</dd></div>
            <div><dt>Course total</dt><dd>{formatNaira(purchase.total_amount_minor)}</dd></div>
            <div><dt>Created</dt><dd>{new Date(purchase.created_at).toLocaleDateString("en-NG")}</dd></div>
            <div><dt>Paystack reference</dt><dd className="company-billing-reference">{referenceByPurchase.get(purchase.purchase_id) ?? "Not started"}</dd></div>
          </dl>
        </article>)}
      </div>}
    </section>)}
  </section>;
}
