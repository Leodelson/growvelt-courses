import { redirect } from "next/navigation";
import Link from "@/app/components/learning-link";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { createClient } from "@/app/lib/supabase/server";
import styles from "../../support/support.module.css";
import adminStyles from "./page.module.css";

export const metadata = { title: "Support inbox" };
export const dynamic = "force-dynamic";

export default async function AdminLearningSupportPage() {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const supabase = await createClient();
  const { data: cases, error } = await supabase.from("learning_support_conversations")
    .select("id,user_id,topic,subject,status,last_message_at,created_at")
    .order("last_message_at", { ascending: false }).limit(100);
  const openCount = cases?.filter((item) => item.status === "open").length ?? 0;
  const waitingCount = cases?.filter((item) => item.status === "waiting").length ?? 0;
  const resolvedCount = cases?.filter((item) => item.status === "resolved").length ?? 0;

  return <main className={styles.page}>
    <header className={styles.hero}><p className="eyebrow">Learning administration</p><h1>Support inbox</h1><p>Reply to Learning account requests here. This inbox is separate from Growvelt Careers and uses Learning accounts only.</p></header>
    <p className={adminStyles.countNote}>Counts reflect the most recent 100 requests shown below.</p>
    <section className={adminStyles.stats} aria-label="Support request totals">
      <article><span>Needs a reply</span><strong>{openCount}</strong></article>
      <article><span>Waiting on learner</span><strong>{waitingCount}</strong></article>
      <article><span>Resolved</span><strong>{resolvedCount}</strong></article>
    </section>
    <section className={styles.card}><div className={styles.sectionHeading}><div><h2>Recent requests</h2><p>Showing the latest 100 cases, most recently updated first.</p></div><Link className="button button-secondary" href="/dashboard/support">View learner support page</Link></div>
      {error ? <p className={styles.error}>The inbox is unavailable. Confirm that Learning&rsquo;s support-inbox migration has been applied.</p> : !cases?.length ? <div className={styles.empty}><strong>No support requests yet</strong><p>New requests from signed-in Learning users will appear here.</p></div> : <div className={styles.cases}>{cases.map((item) => <Link className={styles.case} href={`/dashboard/support/${item.id}`} key={item.id}>
        <span className={`${styles.status} ${item.status === "open" ? styles.open : item.status === "waiting" ? styles.waiting : styles.resolved}`}>{item.status === "open" ? "Needs reply" : item.status === "waiting" ? "Waiting on learner" : "Resolved"}</span>
        <strong>{item.subject}</strong><span>{item.topic} · account {item.user_id.slice(0, 8)}</span>
        <small>Last update · {new Date(item.last_message_at).toISOString().slice(0, 16).replace("T", " ")} UTC</small>
      </Link>)}</div>}
    </section>
  </main>;
}
