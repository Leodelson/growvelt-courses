import { OperationsNavigation, OperationsSummary, OperationRecords } from "@/app/components/admin/operations-workspace";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import ops from "@/app/components/admin/operations.module.css";
import { createClient } from "@/app/lib/supabase/server";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import { createLearningCampaignAction, createLearningCouponAction, disableLearningCampaignAction, disableLearningCouponAction } from "./actions";
import { ActionFeedback } from "./action-feedback";
import { FeaturedCoursePicker } from "./featured-course-picker";
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
type EditorialCampaign = {
  campaign_id: number; campaign_title: string; campaign_message: string;
  starts_at: string; ends_at: string; enabled: boolean; created_at: string;
  campaign_state: "disabled" | "ended" | "scheduled" | "live";
  course_ids: number[]; course_titles: string;
};

const money = (minor: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 2,
}).format(minor / 100);

function CourseChoices({ name, legend, hint, options }: {
  name: string;
  legend: string;
  hint: string;
  options: { id: number; title: string; price: string }[];
}) {
  const hintId = name + "-hint";
  return (
    <fieldset className={styles.courseField} aria-describedby={hintId}>
      <legend>{legend}</legend>
      <small id={hintId}>{hint}</small>
      <div className={styles.courseOptions}>
        {options.map(({ id, title, price }) => (
          <label key={id}>
            <input type="checkbox" name={name} value={id} />
            <span>{title}<small>{price}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [
    { data: couponsData, error: couponsError },
    { data: coursesData, error: coursesError },
    { data: campaignData, error: campaignError },
    query,
  ] = await Promise.all([
    supabase.rpc("list_learning_promotion_coupons_for_admin"),
    supabase.rpc("list_learning_promotion_course_options_for_admin"),
    supabase.rpc("list_learning_editorial_campaigns_for_admin"),
    searchParams,
  ]);
  const coupons = (Array.isArray(couponsData) ? couponsData : []) as Coupon[];
  const courses = (Array.isArray(coursesData) ? coursesData : []) as CourseOption[];
  const campaigns = (Array.isArray(campaignData) ? campaignData : []) as EditorialCampaign[];
  const courseTitles = new Map(courses.map((course) => [course.course_id, course.title]));
  const testCouponCheckoutActive = process.env.PAYSTACK_MODE === "test"
    && process.env.PAYMENTS_CHECKOUT_ENABLED === "true"
    && process.env.PAYMENTS_TEST_COUPONS_ENABLED === "true";
  const queryValue = (key: string) => Array.isArray(query[key]) ? query[key]?.[0] : query[key];
  const error = queryValue("error");
  const successMessage = queryValue("created") ? "Coupon created. It can only be redeemed when the Test Mode fixture and coupon feature gates are satisfied."
    : queryValue("disabled") ? "Coupon disabled. Existing payment behavior is unchanged."
    : queryValue("campaignCreated") ? "Featured campaign saved. It appears on dashboard Home and public Explore during its display window."
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
      <p className="eyebrow">Growvelt Admin</p>
      <h1>Promotions and coupons</h1>
      <p>Schedule what learners see on Home and manage private checkout test codes.</p>
    </header>

    <OperationsSummary items={[{label:"Live campaigns",value:campaignError?", ":campaigns.filter(item=>item.campaign_state==="live").length,detail:"Live state in the loaded schedule"},{label:"Enabled coupon codes",value:couponsError?", ":coupons.filter(item=>item.active).length,detail:"Enabled does not mean currently redeemable"},{label:"Recorded redemptions",value:couponsError?", ":coupons.reduce((sum,item)=>sum+item.redeemed_count,0),detail:"Across the loaded coupon register"}]} note="Editorial campaigns and coupons are separate. An enabled code must still meet its date, course, learner and checkout restrictions." />

    <ActionFeedback message={errorMessage ?? successMessage} kind={errorMessage ? "error" : "success"} />

    <section id="campaign-create" className={styles.panel}>
      <header><p className="eyebrow">Appears on Learning Home</p><h2>Feature a campaign</h2><p>The title and short message fill the Home banner. The selected courses appear below it and on public Explore.</p></header>
      <form action={createLearningCampaignAction} className={styles.form}>
        <label>Campaign title<input name="campaignTitle" required minLength={3} maxLength={80} placeholder="Featured learning" /></label>
        <label className={styles.courseField}>Short message<textarea name="campaignMessage" required minLength={3} maxLength={240} rows={3} placeholder="A short introduction to this collection of courses." /></label>
        <label>Starts (Africa/Lagos time)<input name="campaignStartsAt" type="datetime-local" /><small>Leave blank to publish now.</small></label>
        <label>Ends (Africa/Lagos time)<input name="campaignEndsAt" type="datetime-local" required /></label>
        <FeaturedCoursePicker />
        <ActionSubmitButton label="Save featured campaign" pendingLabel="Saving campaign…" />
      </form>
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
      <header><p className="eyebrow">Private · Paystack Test Mode</p><h2>Create coupon</h2><p>Issue a code for an assigned tester to redeem on an eligible test course.</p></header>
      <aside className={styles.safety}>
        <strong>{testCouponCheckoutActive ? "Test coupon checkout is enabled" : "Test coupon checkout is disabled"}</strong>
        <p>Codes are restricted to test checkout and stay in the admin register. Each tester can redeem a code once. To change coupon terms, disable the code and create a replacement.</p>
      </aside>
      {coursesError ? <p className={styles.error}>Eligible courses could not be loaded. Try again later.</p> : courses.length === 0 ? <p className={styles.muted}>There are no eligible paid courses or active test fixtures yet.</p> : <form action={createLearningCouponAction} className={styles.form}>
        <label>Coupon code<input name="code" required minLength={4} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,23}" autoCapitalize="characters" autoComplete="off" placeholder="WELCOME10" /></label>
        <label>Discount type<select name="discountKind" defaultValue="fixed"><option value="fixed">Fixed amount (NGN)</option><option value="percentage">Percentage</option></select></label>
        <label>Discount value<input name="discountValue" type="number" min="0.01" step="0.01" required /><small>Enter NGN for fixed discounts, or a percentage from 0.01 to 100.</small></label>
        <label>Maximum discount (NGN)<input name="maxDiscount" type="number" min="0.01" step="0.01" required /></label>
        <label>Minimum customer charge (NGN)<input name="minimumCharge" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
        <label>Starts (Africa/Lagos time)<input name="startsAt" type="datetime-local" required /></label>
        <label>Ends (Africa/Lagos time)<input name="endsAt" type="datetime-local" required /></label>
        <label>Global redemption limit<input name="maxRedemptions" type="number" min="1" max="999999" step="1" placeholder="No fixed cap" /></label>
        <CourseChoices name="courseIds" legend="Eligible courses"
          hint="Choose one to twenty courses. Redemption requires an active test fixture."
          options={courses.map((course) => ({
            id: course.course_id,
            title: course.title,
            price: money(Math.round(Number(course.price_amount) * 100)),
          }))} />
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
