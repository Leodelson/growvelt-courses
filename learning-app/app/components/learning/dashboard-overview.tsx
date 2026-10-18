"use client";

import Link from "@/app/components/learning-link";
import { useState, type CSSProperties } from "react";
import { BookOpen, ArrowUpRight, Award, Bookmark, CircleCheck, Layers3, UserRound, CircleHelp } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import type { Certificate } from "@/app/lib/learning/certificates";
import { courseProgress, learningCourseHref, type LearnerCourse } from "@/app/lib/learning/workspace";
import { learningOverview } from "@/app/lib/learning/overview";
import { overviewCopy } from "@/app/lib/learning/overview-copy";
import styles from "./dashboard-overview.module.css";

export function DashboardOverview({ courses, certificates }: { courses: LearnerCourse[]; certificates: Certificate[] }) {
  const { locale } = useLanguage();
  const text = overviewCopy[locale];
  const data = learningOverview(courses, certificates);
  const [group, setGroup] = useState(data.ongoing.some((item) => item.id !== data.featured?.id) || !data.completed ? "ongoing" : "finished");
  const course = data.featured;
  const featuredProgress = course ? courseProgress(course) : 0;
  const completedCourse = course?.enrollmentStatus === "completed";
  const queue = (group === "ongoing" ? data.ongoing : courses.filter((item) => item.enrollmentStatus === "completed")).filter((item) => item.id !== course?.id).slice(0, 3);
  const certificate = data.issued[0];
  const certificateDate = certificate && Number.isFinite(Date.parse(certificate.issuedAt)) ? new Intl.DateTimeFormat(locale, {dateStyle:"medium"}).format(new Date(certificate.issuedAt)) : null;
  const action = (item: LearnerCourse) => item.enrollmentStatus === "completed" ? text.review : item.resumeLessonId !== null ? courseProgress(item) > 0 ? text.resume : text.start : text.view;

  return <section className={styles.page} aria-labelledby="learner-overview-title">
    <header className={styles.header}><div><p className="eyebrow">{text.eyebrow}</p><h1 id="learner-overview-title">{text.title}</h1><p>{text.intro}</p></div>{course && <Link className="button button-secondary" href="/dashboard/explore">{text.explore}<ArrowUpRight size={17} aria-hidden="true" /></Link>}</header>
    <div className={styles.stats}>{[
      {icon:BookOpen,value:courses.length,label:text.enrolled}, {icon:Layers3,value:data.active,label:text.active}, {icon:CircleCheck,value:data.completed,label:text.completed}, {icon:Award,value:data.issued.length,label:text.certificates},
    ].map(({icon:Icon,value,label}) => <div className={styles.stat} key={label}><Icon size={22} aria-hidden="true"/><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className={styles.focusGrid}>
      {course ? <section className={styles.feature} aria-labelledby="next-course-title"><div className={styles.featureTop}><span className={styles.badge}>{completedCourse ? text.complete : featuredProgress ? text.active : text.ready}</span><BookOpen size={26} aria-hidden="true"/></div><p className="eyebrow">{completedCourse ? text.reviewHeading : text.next}</p><h2 id="next-course-title">{course.title}</h2><p className={styles.summary}>{course.summary || text.intro}</p><div className={styles.meta}><span>{course.category || "Growvelt Learning"}</span><span>{course.level || text.allLevels}</span><span>{course.instructorName || text.unnamed}</span></div><div className={styles.featureBottom}><div><div className={styles.progressLabel}><span>{text.progress}</span><strong>{featuredProgress}%</strong></div><div className={styles.progress} role="progressbar" aria-label={course.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={featuredProgress}><span style={{width:`${featuredProgress}%`}}/></div></div><Link className="button button-primary" href={learningCourseHref(course)}>{action(course)}<ArrowUpRight size={17} aria-hidden="true"/></Link></div></section>
      : <section className={styles.feature} aria-labelledby="start-learning-title"><BookOpen size={36} aria-hidden="true"/><p className="eyebrow">Growvelt Learning</p><h2 id="start-learning-title">{text.emptyTitle}</h2><p className={styles.summary}>{text.emptyCopy}</p><Link className="button button-primary" href="/dashboard/explore">{text.explore}<ArrowUpRight size={17} aria-hidden="true"/></Link></section>}
      <section className={styles.snapshot} aria-labelledby="overview-progress-title"><p className="eyebrow">{text.snapshot}</p><div className={styles.ring} style={{"--progress":`${data.overall}%`} as CSSProperties} aria-hidden="true"><span>{data.overall}%</span></div><h2 id="overview-progress-title">{data.done} / {data.total}</h2><p>{text.activities}</p><small>{text.snapshotCopy}</small></section>
    </div>
    {courses.length > 1 && <section className={styles.panel} aria-labelledby="overview-queue-title"><div className={styles.sectionHeading}><div><h2 id="overview-queue-title">{text.queue}</h2><p>{text.queueCopy}</p></div><Link href="/dashboard/my-learning">{text.allCourses}<ArrowUpRight size={16} aria-hidden="true"/></Link></div><div className={styles.tabs} role="group" aria-label={text.filter}>{["ongoing","finished"].map((value) => <button type="button" key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{text[value as "ongoing" | "finished"]}</button>)}</div><div className={styles.queue} aria-live="polite">{queue.length ? queue.map((item) => <article key={item.id}><span className={styles.courseIcon}><BookOpen size={22} aria-hidden="true"/></span><div><small>{item.category || text.allLevels} · {courseProgress(item)}%</small><h3>{item.title}</h3></div><Link href={learningCourseHref(item)} aria-label={`${action(item)}: ${item.title}`}><span>{action(item)}</span><ArrowUpRight size={18} aria-hidden="true"/><span className="sr-only">: {item.title}</span></Link></article>) : <p className={styles.noQueue}>{text.noQueue}</p>}</div></section>}
    <div className={styles.lowerGrid}>
      <section className={styles.panel} aria-labelledby="overview-milestone-title"><div className={styles.sectionHeading}><div><p className="eyebrow">{text.milestone}</p><h2 id="overview-milestone-title">{certificate ? text.latest : text.noCertificate}</h2></div><Award size={28} aria-hidden="true"/></div>{certificate ? <><h3 className={styles.certificateTitle}>{certificate.courseTitle}</h3>{certificateDate && <p>{certificateDate}</p>}<p>{text.certificateCopy}</p><Link className="button button-secondary" href={`/dashboard/certificates/${encodeURIComponent(certificate.code)}`}>{text.openCertificate}<ArrowUpRight size={16} aria-hidden="true"/></Link></> : <><p>{text.eligibility}</p><Link className="button button-secondary" href="/dashboard/certificates">{text.library}</Link></>}</section>
      <section className={styles.panel} aria-labelledby="overview-subjects-title"><h2 id="overview-subjects-title">{data.subjects.length ? text.subjects : text.toolkit}</h2>{data.subjects.length ? <><p>{text.subjectsCopy}</p><ul className={styles.subjects}>{data.subjects.map(([subject,count]) => <li key={subject}><div><span>{subject}</span><strong>{count}</strong></div><div className={styles.progress} aria-hidden="true"><span style={{width:`${count / courses.length * 100}%`}}/></div></li>)}</ul></> : <div className={styles.quickLinks}><Link href="/dashboard/profile"><UserRound size={20} aria-hidden="true"/>{text.profile}<ArrowUpRight size={16} aria-hidden="true"/></Link><Link href="/frequently-asked-questions"><CircleHelp size={20} aria-hidden="true"/>{text.help}<ArrowUpRight size={16} aria-hidden="true"/></Link></div>}</section>
    </div>
    <nav className={styles.tools} aria-label={text.toolkit}>{[{icon:Bookmark,href:"/dashboard/saved-courses",label:text.saved,description:text.savedCopy},...(data.subjects.length ? [{icon:UserRound,href:"/dashboard/profile",label:text.profile,description:text.profileCopy},{icon:CircleHelp,href:"/frequently-asked-questions",label:text.help,description:text.helpCopy}] : [])].map(({icon:Icon,href,label,description}) => <Link href={href} key={href}><Icon size={23} aria-hidden="true"/><div><strong>{label}</strong><span>{description}</span></div><ArrowUpRight size={17} aria-hidden="true"/></Link>)}</nav>
    <p className={styles.scope}>{text.scope}</p>
  </section>;
}
