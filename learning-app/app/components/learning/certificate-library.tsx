"use client";

import Link from "next/link";
import { useState } from "react";
import { Award, CircleCheck, BookOpen, ArrowUpRight } from "lucide-react";
import type { Certificate } from "@/app/lib/learning/certificates";
import type { LearnerCourse } from "@/app/lib/learning/workspace";
import { useLanguage } from "@/app/components/language-provider";
import { EmptyState } from "@/app/components/ui/empty-state";
import { workspaceCopy } from "@/app/lib/learning/workspace-copy";
import { absoluteLearningUrl } from "@/app/lib/seo";
import { WorkspaceHeader, WorkspaceStat } from "./workspace-parts";
import styles from "./workspace.module.css";

export function CertificateLibrary({ certificates, completedCourses }: { certificates: Certificate[]; completedCourses: Pick<LearnerCourse, "id" | "title" | "slug">[] }) {
  const { locale } = useLanguage();
  const copy = workspaceCopy[locale];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [feedback, setFeedback] = useState<{ code: string; message: string } | null>(null);
  const [copyingCode, setCopyingCode] = useState<string | null>(null);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const visible = certificates.filter((certificate) => (filter === "all" || filter === certificate.status) && [certificate.courseTitle, certificate.code].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => (Date.parse(b.issuedAt) - Date.parse(a.issuedAt)) * (sort === "newest" ? 1 : -1));
  async function copyLink(code: string) { if (copyingCode) return; setCopyingCode(code); setFeedback(null); try { await navigator.clipboard.writeText(absoluteLearningUrl(`/verify-certificate/${encodeURIComponent(code)}`)); setFeedback({ code, message: copy.copied }); } catch { setFeedback({ code, message: copy.copyFailed }); } finally { setCopyingCode(null); } }
  return <section className={styles.page}>
    <WorkspaceHeader eyebrow={copy.certificate} title={copy.certificateTitle} description={copy.certificateIntro} href="/dashboard/my-learning" action={copy.learningLink} />
    <div className={styles.stats}><WorkspaceStat icon={<Award />} value={certificates.filter((item) => item.status === "issued").length} label={copy.issued}/><WorkspaceStat icon={<CircleCheck />} value={completedCourses.length} label={copy.finishedCourses}/><WorkspaceStat icon={<BookOpen />} value={certificates.filter((item) => item.status === "revoked").length} label={copy.revoked}/></div>
    {certificates.length ? <>
      <div className={styles.toolbar}><label>{copy.searchCertificates}<input type="search" maxLength={120} placeholder={copy.certificatePlaceholder} value={search} onChange={(event) => setSearch(event.target.value)}/></label><label>{copy.certificate}<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{copy.allCertificates}</option><option value="issued">{copy.issued}</option><option value="revoked">{copy.revoked}</option></select></label><label>{copy.sort}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">{copy.newest}</option><option value="oldest">{copy.oldest}</option></select></label></div>
      <div className={styles.resultLine}><p role="status">{visible.length} / {certificates.length} {copy.certificateResults}</p>{search || filter !== "all" || sort !== "newest" ? <button type="button" className={styles.quietButton} onClick={() => { setSearch(""); setFilter("all"); setSort("newest"); }}>{copy.reset}</button> : null}</div>
      <div className={styles.grid}>{visible.map((certificate) => <article className={styles.certificate} key={certificate.code}><div className={styles.certificateTop}><Award aria-hidden="true"/><span className={`${styles.badge} ${certificate.status === "issued" ? styles.completed : ""}`}>{certificate.status === "issued" ? copy.issued : copy.revoked}</span></div><h2>{certificate.courseTitle}</h2><dl><div><dt>{copy.issuedOn}</dt><dd>{dates.format(new Date(certificate.issuedAt))}</dd></div><div><dt>{copy.completedOn}</dt><dd>{dates.format(new Date(certificate.completedAt))}</dd></div><div><dt>{copy.reference}</dt><dd>{certificate.code}</dd></div></dl><div className={styles.certificateActions}><Link className="button button-primary" href={`/dashboard/certificates/${encodeURIComponent(certificate.code)}`}>{copy.viewCertificate}</Link><Link href={`/verify-certificate/${encodeURIComponent(certificate.code)}`}>{copy.verify} ↗</Link>{certificate.status === "issued" ? <button className={styles.quietButton} type="button" disabled={copyingCode !== null} aria-busy={copyingCode === certificate.code} onClick={() => void copyLink(certificate.code)}>{copyingCode === certificate.code ? <span className="catalog-loader" aria-hidden="true" /> : null}{copy.copy}</button> : null}</div>{feedback?.code === certificate.code ? <p role="status" className={styles.notice}>{feedback.message}</p> : null}</article>)}</div>
      {!visible.length ? <div className={styles.empty}><h2>{copy.noMatches}</h2><p>{copy.tryAgain}</p></div> : null}
    </> : <EmptyState titleId="certificates-empty-title" icon="certificate" title={copy.noCertificates} description={copy.noCertificatesCopy} />}
    {completedCourses.length || certificates.length ? <div className={styles.insights} style={{ marginTop: 28, gridTemplateColumns: completedCourses.length && certificates.length ? undefined : "minmax(0, 1fr)" }}>{completedCourses.length ? <section className={styles.panel}><p className="eyebrow">{copy.completed}</p><h2>{copy.finishedCourses}</h2><p>{copy.finishedCopy}</p><div className={styles.completedList}>{completedCourses.map((course) => <Link key={course.id} href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}`}><span>{course.title}<small style={{ display: "block", marginTop: 5 }}>{copy.openCourse}</small></span><ArrowUpRight size={18} aria-hidden="true"/></Link>)}</div></section> : null}{certificates.length ? <section className={styles.panel}><p className="eyebrow">{copy.verification}</p><h2>{copy.sharingTitle}</h2><p>{copy.sharingCopy}</p></section> : null}</div> : null}
  </section>;
}
