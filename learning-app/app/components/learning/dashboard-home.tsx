import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { CourseVideoCover } from "@/app/components/course-video-cover";
import { CourseRatingSummary } from "@/app/components/learning/course-rating-summary";
import { SaveCourseButton } from "@/app/components/learning/save-course-button";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";
import type { ActiveLearningCampaign, PublishedCourse } from "@/app/lib/catalog/published-courses";
import { publicExperienceCopy } from "@/app/lib/public-experience-copy";
import type { Locale } from "@/app/lib/i18n";
import { dashboardHomeCopy } from "./dashboard-home-copy";
import styles from "./dashboard-home.module.css";

function coursePath(course: PublishedCourse) {
  return `/dashboard/courses/${encodeURIComponent(course.slug)}`;
}

function price(course: PublishedCourse, locale: Locale, freeLabel: string) {
  if (course.isFree) return freeLabel;
  if (course.priceAmount === null) return `${course.priceCurrency || "NGN"}`;
  return `${course.priceCurrency || "NGN"} ${new Intl.NumberFormat(locale).format(Number(course.priceAmount))}`;
}

function CourseCard({ course, index, locale, savedCourseIds, copy }: {
  course: PublishedCourse;
  index: number;
  locale: Locale;
  savedCourseIds: number[];
  copy: (typeof dashboardHomeCopy)[Locale];
}) {
  const courseCopy = coursePresentationCopy[locale];
  const href = coursePath(course);
  return <article className={styles.courseCard}>
    <div className={`${styles.cardVisual} course-visual-${["data", "sql", "ai", "product"][index % 4]}`}>
      <Link href={href} className={styles.cardImageLink} tabIndex={-1} aria-hidden="true">
        <span>{course.category || courseCopy.course}</span>
        <CourseVideoCover courseId={course.id} alt="" />
      </Link>
      <div className={styles.save}><SaveCourseButton courseId={course.id} isSaved={savedCourseIds.includes(course.id)} authenticated signInHref={`/sign-up?next=${encodeURIComponent(href)}`} /></div>
    </div>
    <div className={styles.cardBody}>
      <p className={styles.cardCategory}>{course.category || copy.category}</p>
      <p className={styles.cardInstructor}>{course.instructorName || copy.unknownInstructor}</p>
      <h3><Link href={href}>{course.title}</Link></h3>
      <p className={styles.cardSummary}>{course.summary || courseCopy.fallback}</p>
      <CourseRatingSummary averageRating={course.averageRating} ratingCount={course.ratingCount} />
      <div className={styles.cardFooter}><strong>{price(course, locale, courseCopy.free)}</strong><Link href={href}>{copy.viewCourse}<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    </div>
  </article>;
}

export function DashboardHome({ campaign, courses, savedCourseIds, locale }: {
  campaign: ActiveLearningCampaign | null;
  courses: PublishedCourse[];
  savedCourseIds: number[];
  locale: Locale;
}) {
  const copy = dashboardHomeCopy[locale];
  const publicCopy = publicExperienceCopy[locale];
  const spotlight = campaign?.courses[0] ?? courses[0] ?? null;
  const collection = campaign ? campaign.courses.slice(1) : courses.slice(1, 4);
  const courseCopy = coursePresentationCopy[locale];

  return <main className={styles.page} aria-labelledby="dashboard-home-title">
    <header className={styles.header}>
      <div><p className="eyebrow">{copy.eyebrow}</p><h1 id="dashboard-home-title">{copy.title}</h1><p>{copy.intro}</p></div>
      <Link className="button button-secondary" href="/dashboard/my-learning">{copy.myCourses}<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </header>

    <form className={styles.search} action="/dashboard/explore" method="get" role="search" aria-label={copy.searchLabel}>
      <Search size={21} aria-hidden="true" />
      <label className="sr-only" htmlFor="dashboard-home-search">{copy.searchLabel}</label>
      <input id="dashboard-home-search" type="search" name="q" maxLength={120} placeholder={copy.searchPlaceholder} />
      <button type="submit"><span>{copy.searchAction}</span><ArrowUpRight size={16} aria-hidden="true" /></button>
    </form>

    <section className={styles.subjects} aria-labelledby="dashboard-subjects-title">
      <div className={styles.sectionHeading}><div><p className="eyebrow">{copy.browseSubjects}</p><h2 id="dashboard-subjects-title">{publicCopy.home.subjectsTitle}</h2></div><Link href="/dashboard/explore">{copy.allCourses}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div className={styles.subjectGrid}>{publicCopy.subjects.map((subject) => <Link className={styles.subject} href={`/dashboard/explore?category=${encodeURIComponent(subject.category)}`} key={subject.category}><span>{subject.title}</span><small>{subject.copy}</small><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div>
    </section>

    {spotlight ? <section className={styles.spotlight} aria-labelledby="dashboard-spotlight-title">
      <div className={`${styles.spotlightVisual} course-visual-data`}>
        <span className={styles.spotlightBadge}>{campaign ? copy.featured : copy.discover}</span>
        <span className={styles.visualFallback}>{spotlight.category || courseCopy.course}</span>
        <CourseVideoCover courseId={spotlight.id} alt="" loading="eager" />
      </div>
      <div className={styles.spotlightContent}>
        <p className="eyebrow">{campaign?.title || copy.discover}</p>
        <h2 id="dashboard-spotlight-title">{spotlight.title}</h2>
        <p className={styles.spotlightSummary}>{campaign?.message || spotlight.summary || copy.courseFallback}</p>
        <CourseRatingSummary averageRating={spotlight.averageRating} ratingCount={spotlight.ratingCount} />
        <dl className={styles.courseDetails}>
          <div><dt>{copy.category}</dt><dd>{spotlight.category || courseCopy.subject}</dd></div>
          <div><dt>{copy.level}</dt><dd>{spotlight.level || copy.allLevels}</dd></div>
          <div><dt>{copy.instructor}</dt><dd>{spotlight.instructorName || copy.unknownInstructor}</dd></div>
          <div><dt>{copy.access}</dt><dd>{price(spotlight, locale, courseCopy.free)}</dd></div>
        </dl>
        <div className={styles.actions}>
          <Link className="button button-primary" href={coursePath(spotlight)}>{copy.viewCourse}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          <Link className="button button-secondary" href="/dashboard/explore">{copy.browseCatalog}</Link>
        </div>
      </div>
    </section> : <section className={styles.empty}>
      <p className="eyebrow">{copy.eyebrow}</p><h2>{copy.emptyTitle}</h2><p>{copy.emptyCopy}</p><Link className="button button-primary" href="/dashboard/explore">{copy.browseCatalog}<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </section>}

    {collection.length > 0 ? <section className={styles.collection} aria-labelledby="dashboard-collection-title">
      <div className={styles.sectionHeading}><div><p className="eyebrow">{campaign ? copy.featured : copy.discover}</p><h2 id="dashboard-collection-title">{campaign ? copy.moreFeatured : copy.moreCourses}</h2></div><Link href="/dashboard/explore">{copy.allCourses}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div className={styles.courseGrid}>{collection.map((course, index) => <CourseCard course={course} index={index} locale={locale} savedCourseIds={savedCourseIds} copy={copy} key={course.id} />)}</div>
    </section> : null}
  </main>;
}
