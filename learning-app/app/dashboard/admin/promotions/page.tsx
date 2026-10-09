import { createClient } from "@/app/lib/supabase/server";
import { createLearningCouponAction, disableLearningCouponAction } from "./actions";
import styles from "./promotions.module.css";

export const metadata = { title: "Promotions and coupons" };
export const dynamic = "force-dynamic";

type CourseOption = { course_id: number; title: string; price_amount: number; currency: string };
type Coupon = {
  coupon_id: number; code: string; discount_kind: "fixed" | "percentage";
  discount_value: number; max_discount_minor: number; minimum_charge_minor: number;
  starts_at: string; ends_at: string; max_redemptions: number | null;
  active: boolean; redeemed_count: number; course_ids: number[];
};

const money = (minor: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 2,
}).format(minor / 100);

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [{ data: couponsData, error: couponsError }, { data: coursesData, error: coursesError }, query] = await Promise.all([
    supabase.rpc("list_learning_promotion_coupons_for_admin"),
    supabase.rpc("list_learning_promotion_course_options_for_admin"),
    searchParams,
  ]);
  const coupons = (Array.isArray(couponsData) ? couponsData : []) as Coupon[];
  const courses = (Array.isArray(coursesData) ? coursesData : []) as CourseOption[];
  const courseTitles = new Map(courses.map((course) => [course.course_id, course.title]));
  const testCouponCheckoutActive = process.env.PAYSTACK_MODE === "test"
    && process.env.PAYMENTS_CHECKOUT_ENABLED === "true"
    && process.env.PAYMENTS_TEST_COUPONS_ENABLED === "true";
  const queryValue = (key: string) => Array.isArray(query[key]) ? query[key]?.[0] : query[key];
  const error = queryValue("error");

  return <section className={styles.page + " admin-page section-shell"}>
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Phase 4 · Learning Admin</p>
      <h1>Promotions and coupons</h1>
      <p>Create a code for eligible NGN paid courses. Discounts come only from Growvelt’s platform share, preserving the instructor’s seller share. Coupon redemption is restricted to the assigned tester’s active Test Mode fixture and requires the separate feature flag.</p>
    </header>

    <aside className={styles.safety}>
      <strong>{testCouponCheckoutActive ? "Test Mode coupon checkout enabled" : "Test Mode coupon checkout disabled"}</strong>
      <p>{testCouponCheckoutActive ? "Only the assigned tester can redeem a code on its active fixture course. No Live or company purchase uses coupons." : "Checkout needs Test Mode, learner checkout, and the explicit coupon feature flag. Company purchases, organization courses, private company test courses, subscriptions, and Live payments remain excluded."} Coupon terms cannot be edited after creation; disable a code and issue a new one instead.</p>
    </aside>

    {queryValue("created") && <p className={styles.success} role="status">Coupon created. It can only be redeemed when the Test Mode fixture and coupon feature gates are satisfied.</p>}
    {queryValue("disabled") && <p className={styles.success} role="status">Coupon disabled. Existing payment behavior is unchanged.</p>}
    {error && <p className={styles.error} role="alert">{error === "duplicate" ? "That code already exists. Choose a different code." : error === "invalid" ? "Some coupon settings are invalid. Check the dates, amounts and selected courses." : "The coupon could not be saved. No payment or course access was changed."}</p>}

    <section className={styles.panel}>
      <header><p className="eyebrow">Administrator-issued</p><h2>Create coupon</h2><p>Choose one or more eligible courses. Learner use is limited to one redemption per account.</p></header>
      {coursesError ? <p className={styles.error}>Eligible courses could not be loaded. Try again later.</p> : courses.length === 0 ? <p className={styles.muted}>There are no eligible published paid courses or active Test Mode fixtures yet.</p> : <form action={createLearningCouponAction} className={styles.form}>
        <label>Coupon code<input name="code" required minLength={4} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,23}" autoCapitalize="characters" autoComplete="off" placeholder="WELCOME10" /></label>
        <label>Discount type<select name="discountKind" defaultValue="fixed"><option value="fixed">Fixed amount (NGN)</option><option value="percentage">Percentage</option></select></label>
        <label>Discount value<input name="discountValue" type="number" min="0.01" step="0.01" required /><small>Enter NGN for fixed discounts, or a percentage from 0.01 to 100.</small></label>
        <label>Maximum discount (NGN)<input name="maxDiscount" type="number" min="0.01" step="0.01" required /></label>
        <label>Minimum customer charge (NGN)<input name="minimumCharge" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
        <label>Starts (Africa/Lagos time)<input name="startsAt" type="datetime-local" required /></label>
        <label>Ends (Africa/Lagos time)<input name="endsAt" type="datetime-local" required /></label>
        <label>Global redemption limit<input name="maxRedemptions" type="number" min="1" max="999999" step="1" placeholder="No fixed cap" /></label>
        <label className={styles.courseField}>Eligible courses<select name="courseIds" required multiple size={Math.min(Math.max(courses.length, 3), 8)}>{courses.map((course) => <option value={course.course_id} key={course.course_id}>{course.title} · {money(Math.round(Number(course.price_amount) * 100))}</option>)}</select><small>Use Ctrl (Windows) or Command (Mac) to select multiple courses. Company-only courses and inactive fixtures are not shown.</small></label>
        <button className="button button-primary" type="submit">Create coupon</button>
      </form>}
    </section>

    <section className={styles.panel}>
      <header><p className="eyebrow">Private administration</p><h2>Coupon codes</h2><p>Codes and redemption counters are visible only to Learning Admin.</p></header>
      {couponsError ? <p className={styles.error}>Coupon records could not be loaded safely. The list is not being treated as empty.</p> : coupons.length === 0 ? <p className={styles.muted}>No coupon codes have been created.</p> : <div className={styles.list}>{coupons.map((coupon) => <article key={coupon.coupon_id}>
        <div className={styles.heading}><div><strong><code>{coupon.code}</code></strong><span>{coupon.discount_kind === "fixed" ? money(coupon.discount_value) : (coupon.discount_value / 100).toFixed(2) + "%"} · max {money(coupon.max_discount_minor)}</span></div><span className={coupon.active ? styles.active : styles.disabled}>{coupon.active ? "Active" : "Disabled"}</span></div>
        <dl><div><dt>Eligible courses</dt><dd>{coupon.course_ids.map((id) => courseTitles.get(id) ?? "Course #" + id).join(", ")}</dd></div><div><dt>Redemptions</dt><dd>{coupon.redeemed_count}{coupon.max_redemptions === null ? "" : " / " + coupon.max_redemptions}</dd></div><div><dt>Window</dt><dd>{new Date(coupon.starts_at).toLocaleString("en-NG")} – {new Date(coupon.ends_at).toLocaleString("en-NG")}</dd></div><div><dt>Minimum charge</dt><dd>{money(coupon.minimum_charge_minor)}</dd></div></dl>
        {coupon.active && <form action={disableLearningCouponAction}><input type="hidden" name="couponId" value={coupon.coupon_id} /><button className="button button-secondary" type="submit">Disable coupon</button></form>}
      </article>)}</div>}
    </section>
  </section>;
}
