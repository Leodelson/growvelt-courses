import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import Link from "@/app/components/learning-link";
import {createClient} from "@/app/lib/supabase/server";
import {createAdminClient} from "@/app/lib/supabase/admin";
import {isLearningAdmin} from "@/app/lib/admin/authorization";
import {isEmailOperator} from "@/app/lib/email/email-center-authorization";
import {readAdminSubmission,type SubmissionAlert} from "@/app/lib/email/admin-submission-content";
import {drainAdminSubmissionAlerts} from "@/app/lib/email/admin-submission-runtime";
import {learningPath} from "@/app/lib/site-urls.mjs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export const metadata={title:"Submission alerts"};
async function authorize(){const{data:{user}}=await(await createClient()).auth.getUser();if(!isEmailOperator(user)||!await isLearningAdmin())redirect(learningPath("/dashboard"));}
async function checkPending(){"use server";await authorize();await drainAdminSubmissionAlerts();revalidatePath(learningPath("/dashboard/admin/submissions"));}
export default async function AdminSubmissions(){
  await authorize();const database=createAdminClient();
  const result=await database.from("learning_admin_submission_alerts").select("id,kind,source_id,source_version,actor_id,created_at").order("created_at",{ascending:false}).limit(10);
  const rows=await Promise.all((result.data??[]).map(async row=>({row,content:await readAdminSubmission(database,row as SubmissionAlert)})));
  const ids=rows.map(({row})=>row.id);const deliveries=ids.length?await database.from("learning_admin_submission_deliveries").select("alert_id,recipient,state,failure_code,provider_id").in("alert_id",ids):{data:[],error:null};
  return (
    <section className="admin-page section-shell">
      <Link href="/dashboard/admin">Back to administration</Link>
      <header className="admin-page-header">
        <p className="eyebrow">Private administrator inbox</p>
        <h1>Submission alerts</h1>
        <p>New review requests are saved before email is attempted. Each request targets both designated administrators. Accepted means the provider accepted the email, not confirmed inbox delivery.</p>
      </header>
      <p>Each check processes a short batch within the approved daily allowance. Daily safeguards preserve shared capacity for account and security messages. Pending stays queued. Dispatching or uncertain must be investigated, never blindly resent.</p>
      <form action={checkPending}><button className="button button-secondary">Send pending alerts</button></form>
      {result.error || deliveries.error ? (
        <p role="alert">Alert history is unavailable. Check the migration and server configuration; existing submissions remain saved.</p>
      ) : rows.length ? rows.map(({row, content}) => (
        <article className="admin-application-detail" key={row.id}>
          <h2>{content?.title ?? "Source removed or superseded"}</h2>
          <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("en-GB", {timeZone:"Africa/Lagos"})} WAT</time>
          <p>{deliveries.data?.filter(item => item.alert_id === row.id).map(item => `${item.recipient === "owner" ? "Owner admin" : "admin@growvelt.com"}: ${item.state}${item.failure_code ? ` (${item.failure_code})` : ""}`).join(" · ")}</p>
          {content && <>
            <dl>{content.fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{field.value}</dd></div>)}</dl>
            {row.kind !== "inquiry" && <Link href={content.path} className="button button-secondary">Open review workspace</Link>}
          </>}
        </article>
      )) : <p>No new submission alerts since activation. Earlier submissions were not backfilled or emailed automatically.</p>}
    </section>
  );
}
