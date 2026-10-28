import { OperationsNavigation, OperationsSummary, OperationRecords } from "@/app/components/admin/operations-workspace";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import ops from "@/app/components/admin/operations.module.css";
import { createClient } from "@/app/lib/supabase/server";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import { createLearningCampaignAction, createLearningCouponAction, disableLearningCampaignAction, disableLearningCouponAction } from "./actions";
import { ActionFeedback } from "./action-feedback";
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
type EditorialCourseOption = {
  course_id: number; title: string; summary: string | null; category: string | null;
  is_free: boolean; price_amount: number | null; price_currency: string | null;
};
type EditorialCampaign = {
  campaign_id: number; campaign_title: string; campaign_message: string;
  starts_at: string; ends_at: string; enabled: boolean; created_at: string;
  campaign_state: "disabled" | "ended" | "scheduled" | "live";
  course_ids: number[]; course_titles: string;
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
  const [
    { data: couponsData, error: couponsError },
    { data: coursesData, error: coursesError },
    { data: editorialCoursesData, error: editorialCoursesError },
    { data: campaignData, error: campaignError },
    query,
  ] = await Promise.all([
    supabase.rpc("list_learning_promotion_coupons_for_admin"),
    supabase.rpc("list_learning_promotion_course_options_for_admin"),
    supabase.rpc("list_learning_editorial_courses_for_admin"),
    supabase.rpc("list_learning_editorial_campaigns_for_admin"),
    searchParams,
  ]);
  const coupons = (Array.isArray(couponsData) ? couponsData : []) as Coupon[];
  const courses = (Array.isArray(coursesData) ? coursesData : []) as CourseOption[];
  const editorialCourses = (Array.isArray(editorialCoursesData) ? editorialCoursesData : []) as EditorialCourseOption[];
  const campaigns = (Array.isArray(campaignData) ? campaignData : []) as EditorialCampaign[];
  const courseTitles = new Map(courses.map((course) => [course.course_id, course.title]));
  const testCouponCheckoutActive = process.env.PAYSTACK_MODE === "test"
    && process.env.PAYMENTS_CHECKOUT_ENABLED === "true"
    && process.env.PAYMENTS_TEST_COUPONS_ENABLED === "true";
  const queryValue = (key: string) => Array.isArray(query[key]) ? query[key]?.[0] : query[key];
  const error = queryValue("error");
  const successMessage = queryValue("created") ? "Coupon created. It can only be redeemed when the Sandbox Mode fixture and coupon feature gates are satisfied."
    : queryValue("disabled") ? "Coupon disabled. Existing payment behavior is unchanged."
    : queryValue("campaignCreated") ? "Featured campaign scheduled. It will appear on Explore during its selected dates."
    : queryValue("campaignDisabled") ? "Featured campaign disabled. Its record is retained for the admin history."
    : null;
  const errorMessage = error === "duplicate" ? "That code already exists. Choose a different code."
    : error === "invalid" ? "Some coupon settings are invalid. Check the dates, amounts and selected courses."
    : error === "campaign-invalid" ? "Campaign details are invalid. Check the title, dates, and choose one to six eligible courses."
    : error === "campaign-overlap" ? "Another enabled campaign overlaps those dates. Choose a different schedule."
    : error === "campaign-unavailable" ? "The campaign could not be saved. No course, payment, or access data was changed."
    : error ? "The coupon could not be saved. No payment or course access was changed."
    : null;

  return <section className={styles.page + " "+ops.page+" admin-page section-shell"}>
    <OperationsNavigation sections={[{id:"campaign-create",label:"Schedule campaign"},{id:"campaign-history",label:"Campaign history"},{id:"coupon-create",label:"Create coupon"},{id:"coupon-history",label:"Coupon register"}]} />
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Phase 4 · Growvelt Admin</p>
      <h1>Promotions and coupons</h1>
      <p>Curate scheduled featured-course campaigns and manage controlled coupon codes. Featured placement is editorial-only: no placement fee, checkout change, seller-share adjustment, or automatic transfer.</p>
    </header>

    <OperationsSummary items={[{label:"Live campaigns",value:campaignError?", ":campaigns.filter(item=>item.campaign_state==="live").length,detail:"Live state in the loaded schedule"},{label:"Enabled coupon codes",value:couponsError?", ":coupons.filter(item=>item.active).length,detail:"Enabled does not mean currently redeemable"},{label:"Recorded redemptions",value:couponsError?", ":coupons.reduce((sum,item)=>sum+item.redeemed_count,0),detail:"Across the loaded coupon register"}]} note="Editorial campaigns and coupons are separate. An enabled code must still meet its date, course, learner and checkout restrictions." />
    <aside className={styles.safety}>
      <strong>{testCouponCheckoutActive ? "Sandbox Mode coupon checkout enabled" : "Sandbox Mode coupon checkout disabled"}</strong>
      <p>{testCouponCheckoutActive ? "Only the assigned tester can redeem a code on its active fixture course. No Live or company purchase uses coupons." : "Checkout needs Sandbox Mode, learner checkout, and the explicit coupon feature flag. Company purchases, organization courses, private company sandbox courses, subscriptions, and Live payments remain excluded."} Coupon terms cannot be edited after creation; disable a code and issue a new one instead.</p>
    </aside>

    <ActionFeedback message={errorMessage ?? successMessage} kind={errorMessage ? "error" : "success"} />

    <section id="campaign-create" className={styles.panel}>
      <header><p className="eyebrow">Editorial merchandising · No placement fee</p><h2>Schedule a featured campaign</h2><p>Choose up to six published courses with an instructor or provider organization and a display window. The campaign appears on public and dashboard Explore pages only during that window. Company-only courses and Paystack sandbox fixtures are excluded.</p></header>
      {editorialCoursesError ? <p className={styles.error}>Eligible published courses could not be loaded. Try again later.</p> : editorialCourses.length === 0 ? <p className={styles.muted}>There are no eligible published courses with an instructor or provider organization to feature yet.</p> : <form action={createLearningCampaignAction} className={styles.form}>
        <label>Campaign title<input name="campaignTitle" required minLength={3} maxLength={80} placeholder="Featured learning" /></label>
        <label className={styles.courseField}>Short message<textarea name="campaignMessage" required minLength={3} maxLength={240} rows={3} placeholder="A short introduction to this collection of courses." /></label>
        <label>Starts (Africa/Lagos time)<input name="campaignStartsAt" type="datetime-local" required /></label>
        <label>Ends (Africa/Lagos time)<input name="campaignEndsAt" type="datetime-local" required /></label>
        <label className={styles.courseField}>Featured courses<select name="campaignCourseIds" required multiple size={Math.min(Math.max(editorialCourses.length, 3), 8)}>{editorialCourses.map((course) => <option value={course.course_id} key={course.course_id}>{course.title} · {course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</option>)}</select><small>Choose one to six courses. Hold Ctrl (Windows) or Command (Mac) to choose more than one. A course must still be published and publicly eligible when the campaign is displayed.</small></label>
        <ActionSubmitButton label="Schedule featured campaign" pendingLabel="Scheduling campaign…" />
      </form>}
    </section>

    <section id="campaign-history" className={styles.panel}>
      <header><p className="eyebrow">Editorial schedule</p><h2>Featured campaigns</h2><p>Only one enabled campaign may occupy a time window. Disabling a campaign is immediate and keeps its history.</p></header>
      {campaignError ? <p className={styles.error}>Campaign records could not be loaded safely. The list is not being treated as empty.</p> : campaigns.length === 0 ? <p className={styles.muted}>No featured campaigns have been scheduled.</p> : <div className={styles.list}><OperationRecords searchLabel="Find campaigns by title, message or course" items={campaigns.map((campaign) => {
        const state = campaign.campaign_state.charAt(0).toUpperCase() + campaign.campaign_state.slice(1);
        return {id:String(campaign.campaign_id),title:campaign.campaign_title,group:campaign.campaign_state,keywords:campaign.campaign_message+" "+campaign.course_titles,content:<article>
          <div className={styles.heading}><div><strong>{campaign.campaign_title}</strong><span>{campaign.campaign_message}</span></div><span className={campaign.enabled ? styles.active : styles.disabled}>{state}</span></div>
          <dl><div><dt>Featured courses</dt><dd>{campaign.course_titles || campaign.course_ids.map((id) => `Course #${id}`).join(", ")}</dd></div><div><dt>Window</dt><dd>{reviewDate(campaign.starts_at,"en",undefined,true)}  to {reviewDate(campaign.ends_at,"en",undefined,true)}</dd></div></dl>
          {campaign.enabled && <form action={disableLearningCampaignAction}><input type="hidden" name="campaignId" value={campaign.campaign_id} /><ActionSubmitButton label="Disable campaign" pendingLabel="Disabling campaign…" tone="secondary" /></form>}
        </article>};
      })} /></div>}
    </section>

    <section id="coupon-create" className={styles.panel}>
      <header><p className="eyebrow">Administrator-issued</p><h2>Create coupon</h2><p>Choose one or more eligible courses. Learner use is limited to one redemption per account.</p></header>
      {coursesError ? <p className={styles.error}>Eligible courses could not be loaded. Try again later.</p> : courses.length === 0 ? <p className={styles.muted}>There are no eligible published paid courses or active Sandbox Mode fixtures yet.</p> : <form action={createLearningCouponAction} className={styles.form}>
        <label>Coupon code<input name="code" required minLength={4} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,23}" autoCapitalize="characters" autoComplete="off" placeholder="WELCOME10" /></label>
        <label>Discount type<select name="discountKind" defaultValue="fixed"><option value="fixed">Fixed amount (NGN)</option><option value="percentage">Percentage</option></select></label>
        <label>Discount value<input name="discountValue" type="number" min="0.01" step="0.01" required /><small>Enter NGN for fixed discounts, or a percentage from 0.01 to 100.</small></label>
        <label>Maximum discount (NGN)<input name="maxDiscount" type="number" min="0.01" step="0.01" required /></label>
        <label>Minimum customer charge (NGN)<input name="minimumCharge" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
        <label>Starts (Africa/Lagos time)<input name="startsAt" type="datetime-local" required /></label>
        <label>Ends (Africa/Lagos time)<input name="endsAt" type="datetime-local" required /></label>
        <label>Global redemption limit<input name="maxRedemptions" type="number" min="1" max="999999" step="1" placeholder="No fixed cap" /></label>
        <label className={styles.courseField}>Eligible courses<select name="courseIds" required multiple size={Math.min(Math.max(courses.length, 3), 8)}>{courses.map((course) => <option value={course.course_id} key={course.course_id}>{course.title} · {money(Math.round(Number(course.price_amount) * 100))}</option>)}</select><small>Use Ctrl (Windows) or Command (Mac) to select multiple courses. Company-only courses and inactive fixtures are not shown.</small></label>
        <ActionSubmitButton label="Create coupon" pendingLabel="Creating coupon…" />
      </form>}
    </section>

    <section id="coupon-history" className={styles.panel}>
      <header><p className="eyebrow">Private administration</p><h2>Coupon codes</h2><p>Codes and redemption counters are visible only to Growvelt Admin.</p></header>
      {couponsError ? <p className={styles.error}>Coupon records could not be loaded safely. The list is not being treated as empty.</p> : coupons.length === 0 ? <p className={styles.muted}>No coupon codes have been created.</p> : <div className={styles.list}><OperationRecords searchLabel="Find coupon codes or eligible courses" items={coupons.map((coupon) => ({id:String(coupon.coupon_id),title:coupon.code,group:coupon.active?"enabled":"disabled",keywords:coupon.course_ids.map(id=>courseTitles.get(id)??"Course #"+id).join(" "),content:<article>
        <div className={styles.heading}><div><strong><code>{coupon.code}</code></strong><span>{coupon.discount_kind === "fixed" ? money(coupon.discount_value) : (coupon.discount_value / 100).toFixed(2) + "%"} · max {money(coupon.max_discount_minor)}</span></div><span className={coupon.active ? styles.active : styles.disabled}>{coupon.active ? "Active" : "Disabled"}</span></div>
        <dl><div><dt>Eligible courses</dt><dd>{coupon.course_ids.map((id) => courseTitles.get(id) ?? "Course #" + id).join(", ")}</dd></div><div><dt>Redemptions</dt><dd>{coupon.redeemed_count}{coupon.max_redemptions === null ? "" : " / " + coupon.max_redemptions}</dd></div><div><dt>Window</dt><dd>{reviewDate(coupon.starts_at,"en",undefined,true)}  to {reviewDate(coupon.ends_at,"en",undefined,true)}</dd></div><div><dt>Minimum charge</dt><dd>{money(coupon.minimum_charge_minor)}</dd></div></dl>
        {coupon.active && <form action={disableLearningCouponAction}><input type="hidden" name="couponId" value={coupon.coupon_id} /><ActionSubmitButton label="Disable coupon" pendingLabel="Disabling coupon…" tone="secondary" /></form>}
      </article>}))} /></div>}
    </section>
  </section>;
}
