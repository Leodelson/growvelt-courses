"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { BookOpen, CircleCheck, Layers3 } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import { EmptyState } from "@/app/components/ui/empty-state";
import { filterLearningCourses, courseProgress, learningCourseHref, type LearnerCourse, type LearningFilter, type LearningSort } from "@/app/lib/learning/workspace";
import { workspaceCopy } from "@/app/lib/learning/workspace-copy";
import { WorkspaceHeader, WorkspaceStat } from "./workspace-parts";
import styles from "./workspace.module.css";

export function LearningLibrary({ courses }: { courses: LearnerCourse[] }) {
  const { locale } = useLanguage();
  const copy = workspaceCopy[locale];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LearningFilter>("all");
  const [sort, setSort] = useState<LearningSort>("recent");
  const visible = filterLearningCourses(courses, search, filter, sort);
  const completed = courses.filter((course) => course.enrollmentStatus === "completed").length;
  const active = courses.filter((course) => course.enrollmentStatus !== "completed" && courseProgress(course) > 0).length;
  const activitiesDone = courses.reduce((total, course) => total + course.completedLessons, 0);
  const activitiesTotal = courses.reduce((total, course) => total + course.totalLessons, 0);
  const overall = activitiesTotal ? Math.min(100, Math.round(activitiesDone / activitiesTotal * 100)) : 0;
  const next = courses.filter((course) => course.enrollmentStatus !== "completed" && course.totalLessons > course.completedLessons).sort((a, b) => courseProgress(b) - courseProgress(a))[0];
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const reset = () => { setSearch(""); setFilter("all"); setSort("recent"); };
  return <section className={styles.page}>
    <WorkspaceHeader eyebrow={copy.learning} title={copy.learningTitle} description={copy.learningIntro} href="/dashboard/explore" action={copy.explore} />
    <div className={styles.stats}><WorkspaceStat icon={<BookOpen />} value={courses.length} label={copy.enrolled}/><WorkspaceStat icon={<Layers3 />} value={active} label={copy.active}/><WorkspaceStat icon={<CircleCheck />} value={completed} label={copy.completed}/></div>
    {courses.length ? <>
      <div className={styles.insights}>
        <section className={`${styles.panel} ${styles.snapshot}`}><div className={styles.ring} style={{ "--progress": `${overall}%` } as CSSProperties} aria-label={`${overall}%`}><span>{overall}%</span></div><div><h2>{copy.snapshot}</h2><p>{copy.snapshotCopy}</p><strong>{activitiesDone} / {activitiesTotal} {copy.activitiesDone}</strong></div></section>
        <section className={styles.panel}><p className="eyebrow">{next ? copy.next : completed > 0 ? copy.completed : copy.learning}</p>{next ? <><h2><Link href={`/dashboard/my-learning/${encodeURIComponent(next.slug)}`}>{next.title}</Link></h2><p>{copy.nextCopy}</p><strong>{Math.max(0, next.totalLessons - next.completedLessons)} {copy.left}</strong></> : completed > 0 ? <><h2>{copy.certificates}</h2><p>{copy.completedCopy}</p><Link href="/dashboard/certificates">{copy.certificates} →</Link></> : <><h2>{copy.details}</h2><p>{copy.learningIntro}</p></>}</section>
      </div>
      <div className={styles.toolbar}><label>{copy.search}<input type="search" maxLength={120} placeholder={copy.placeholder} value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>{copy.learning}<select value={filter} onChange={(event) => setFilter(event.target.value as LearningFilter)}>{(["all", "active", "ready", "completed"] as const).map((status) => <option key={status} value={status}>{copy[status]}</option>)}</select></label><label>{copy.sort}<select value={sort} onChange={(event) => setSort(event.target.value as LearningSort)}><option value="recent">{copy.recent}</option><option value="progress">{copy.progress}</option><option value="title">{copy.alphabetical}</option></select></label></div>
      <div className={styles.resultLine}><p role="status">{visible.length} / {courses.length} {copy.results}</p>{search || filter !== "all" || sort !== "recent" ? <button type="button" className={styles.quietButton} onClick={reset}>{copy.reset}</button> : null}</div>
      <div className={styles.list}>{visible.map((course) => { const progress = courseProgress(course); const done = course.enrollmentStatus === "completed"; return <article className={styles.course} key={course.id}>
        <div className={styles.cover}><BookOpen aria-hidden="true"/><CourseVideoCover courseId={course.id} alt="" /></div>
        <div className={styles.courseBody}><span className={`${styles.badge} ${done ? styles.completed : ""}`}>{done ? copy.completed : progress > 0 ? copy.active : copy.ready}</span><h2>{course.title}</h2><div className={styles.meta}><small>{course.category || copy.learning}</small><small>{course.level || copy.allLevels}</small><small>{course.instructorName || copy.unknownInstructor}</small></div><div className={styles.progress} role="progressbar" aria-label={course.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div><small>{course.completedLessons} / {course.totalLessons} {copy.activities} · {progress}%</small><p>{copy.enrolledOn} {dates.format(new Date(course.enrolledAt))}</p></div>
        <div className={styles.courseActions}><Link className="button button-primary" href={learningCourseHref(course)}>{done ? copy.review : course.resumeLessonId !== null ? copy.continue : course.totalLessons > 0 ? copy.start : copy.view} →</Link>{!done && course.resumeLessonId !== null ? <Link href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}`}>{copy.details}</Link> : null}</div>
      </article>; })}</div>
      {!visible.length ? <div className={styles.empty}><h2>{copy.noMatches}</h2><p>{copy.tryAgain}</p></div> : <p className={styles.end}>{copy.end}</p>}
    </> : <EmptyState titleId="learning-empty-title" icon="learning" title={copy.learningEmpty} description={copy.learningEmptyCopy} primaryAction={{ href: "/dashboard/explore", label: copy.explore }} secondaryAction={{ href: "/dashboard/saved-courses", label: copy.saved }} />}
  </section>;
}
