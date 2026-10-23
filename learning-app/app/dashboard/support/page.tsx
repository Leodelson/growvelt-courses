import { redirect } from "next/navigation";
import Link from "@/app/components/learning-link";
import { createClient } from "@/app/lib/supabase/server";
import { SupportCaseForm } from "./case-form";
import styles from "./support.module.css";

export const metadata = { title: "Growvelt support" };
export const dynamic = "force-dynamic";

export default async function LearningSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/support");
  const { data: cases, error } = await supabase.from("learning_support_conversations").select("id,subject,topic,status,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30);
  return <main className={styles.page}><header className={styles.hero}><p className="eyebrow">Growvelt support</p><h1>We&rsquo;re here to help.</h1><p>Send a request to the Growvelt team and follow replies from your dashboard. For general questions, the Help Assistant may have a quick answer.</p></header><div className={styles.grid}><SupportCaseForm /><section className={styles.card}><h2>Your requests</h2>{error ? <p>Requests are temporarily unavailable.</p> : !cases?.length ? <div className={styles.empty}>You have not opened a support request yet.</div> : <div className={styles.cases}>{cases.map((item) => <Link className={styles.case} key={item.id} href={`/dashboard/support/${item.id}`}><strong>{item.subject}</strong><span className={`${styles.status} ${item.status === "open" ? styles.open : item.status === "waiting" ? styles.waiting : styles.resolved}`}>{item.status === "open" ? "Awaiting Growvelt team" : item.status === "waiting" ? "Your reply needed" : "Resolved"}</span><small>Updated {new Date(item.updated_at).toLocaleString()}</small></Link>)}</div>}</section></div></main>;
}
