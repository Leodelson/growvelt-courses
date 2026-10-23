"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Layers3, BookOpen } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PublishedCourseCard } from "@/app/components/published-course-card";
import { useLanguage } from "@/app/components/language-provider";
import type { PublishedCourse } from "@/app/lib/catalog/published-courses";
import { workspaceCopy } from "@/app/lib/learning/workspace-copy";
import { filterSavedCourses } from "@/app/lib/learning/workspace";
import { WorkspaceHeader, WorkspaceStat } from "./workspace-parts";
import styles from "./workspace.module.css";

export function SavedCoursesList({ courses: initialCourses }: { courses: PublishedCourse[] }) {
  const { locale } = useLanguage();
  const copy = workspaceCopy[locale];
  const [courses, setCourses] = useState(initialCourses);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [access, setAccess] = useState("all");
  const [sort, setSort] = useState("saved");
  const [selected, setSelected] = useState<number[]>([]);
  const subjects = [...new Set(courses.map((course) => course.category).filter((value): value is string => Boolean(value)))].sort();
  const visible = filterSavedCourses(courses, search, category, access, sort);
  const comparison = courses.filter((course) => selected.includes(course.id));
  const price = (course: PublishedCourse) => course.isFree ? copy.free : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString(locale)}`;
  const reset = () => { setSearch(""); setCategory(""); setAccess("all"); setSort("saved"); };
  return <section className={styles.page}>
    <WorkspaceHeader eyebrow={copy.saved} title={copy.savedTitle} description={copy.savedIntro} href="/dashboard/explore" action={copy.explore} />
    <div className={styles.stats}><WorkspaceStat icon={<Heart />} value={courses.length} label={copy.savedCount}/><WorkspaceStat icon={<Layers3 />} value={subjects.length} label={copy.subjects}/><WorkspaceStat icon={<BookOpen />} value={courses.filter((course) => course.isFree).length} label={copy.free}/></div>
    {courses.length ? <>
      <section className={`${styles.panel} ${styles.comparison}`} aria-labelledby="course-comparison-title"><header><div><h2 id="course-comparison-title">{copy.comparison}</h2><p>{copy.compareCopy}</p></div>{selected.length ? <button className={styles.quietButton} type="button" onClick={() => setSelected([])}>{copy.resetComparison}</button> : null}</header><p role="status">{comparison.length} / 3 {copy.selected}{comparison.length < 2 ? ` · ${copy.compareHint}` : ""}</p>
        {comparison.length >= 2 ? <div className={styles.tableScroll} tabIndex={0} aria-label={copy.comparison}><table className={styles.table}><caption className="sr-only">{copy.comparison}</caption><thead><tr><th scope="col">{copy.compare}</th>{comparison.map((course) => <th scope="col" key={course.id}><Link href={`/dashboard/courses/${encodeURIComponent(course.slug)}`}>{course.title} ↗</Link></th>)}</tr></thead><tbody>
          {([[copy.price, price], [copy.category, (course: PublishedCourse) => course.category || ", "], [copy.level, (course: PublishedCourse) => course.level || copy.allLevels], [copy.instructor, (course: PublishedCourse) => course.instructorName || copy.unknownInstructor], [copy.rating, (course: PublishedCourse) => course.ratingCount && course.averageRating ? `${course.averageRating.toFixed(1)} / 5 (${course.ratingCount})` : copy.notRated]] as const).map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{comparison.map((course) => <td key={course.id}>{value(course)}</td>)}</tr>)}
        </tbody></table></div> : null}
      </section>
      <div className={`${styles.toolbar} ${styles.four}`}><label>{copy.search}<input type="search" maxLength={120} placeholder={copy.placeholder} value={search} onChange={(event) => setSearch(event.target.value)}/></label><label>{copy.category}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{copy.allCategories}</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label><label>{copy.access}<select value={access} onChange={(event) => setAccess(event.target.value)}><option value="all">{copy.allAccess}</option><option value="free">{copy.free}</option><option value="paid">{copy.paid}</option></select></label><label>{copy.sort}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="saved">{copy.savedOrder}</option><option value="title">{copy.alphabetical}</option><option value="free">{copy.freeFirst}</option></select></label></div>
      <div className={styles.resultLine}><p role="status">{visible.length} / {courses.length} {copy.results}</p>{search || category || access !== "all" || sort !== "saved" ? <button type="button" className={styles.quietButton} onClick={reset}>{copy.reset}</button> : null}</div>
      <div className={styles.grid}>{visible.map((course, index) => <div className={styles.compareItem} key={course.id}><label className={styles.compareChoice}><input type="checkbox" checked={selected.includes(course.id)} disabled={!selected.includes(course.id) && selected.length >= 3} aria-label={`${copy.compare}: ${course.title}`} onChange={(event) => setSelected((current) => event.target.checked ? current.length < 3 ? [...current, course.id] : current : current.filter((id) => id !== course.id))}/>{copy.compare}</label><PublishedCourseCard course={course} index={index} authenticated isSaved href={`/dashboard/courses/${encodeURIComponent(course.slug)}`} onSavedChange={(isSaved) => { if (!isSaved) { setCourses((current) => current.filter((item) => item.id !== course.id)); setSelected((current) => current.filter((id) => id !== course.id)); } }} /></div>)}</div>
      {!visible.length ? <div className={styles.empty}><h2>{copy.noMatches}</h2><p>{copy.tryAgain}</p></div> : null}
    </> : <EmptyState titleId="saved-courses-empty-title" icon="heart" title={copy.savedEmpty} description={copy.savedEmptyCopy} />}
  </section>;
}
