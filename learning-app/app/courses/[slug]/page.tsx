import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { getPublishedLearningCourse, getRelatedLearningCourses } from "@/app/lib/catalog/published-courses";
import { CourseDetailHeader } from "@/app/components/course-detail-header";
import { CourseShelf } from "@/app/components/course-shelf";
import styles from "@/app/components/course-detail.module.css";
import { coursePresentationCopy } from "@/app/lib/catalog/course-presentation-copy";
import { absoluteLearningUrl, defaultSocialImage } from "@/app/lib/seo";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { translate, type Locale } from "@/app/lib/i18n";

function lessonLabel(locale: Locale, type: "video" | "text" | "quiz" | "project") {
  if (type === "video") return translate(locale, "catalog.videoLesson");
  if (type === "text") return translate(locale, "catalog.textLesson");
  if (type === "quiz") return translate(locale, "catalog.quiz");
  return translate(locale, "catalog.projectLater");
}

function courseDescription(course: Awaited<ReturnType<typeof getPublishedLearningCourse>>) {
  if (!course) return "";
  return course.summary || course.description || "A practical Growvelt course.";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug.length > 220) return { title: "Course unavailable", robots: { index: false, follow: false } };

  const course = await getPublishedLearningCourse(slug);
  if (!course) return { title: "Course unavailable", robots: { index: false, follow: false } };
  const description = courseDescription(course);
  const url = `/courses/${encodeURIComponent(course.slug)}`;

  return {
    title: course.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: `${course.title} | Growvelt`,
      description,
      images: [{ url: defaultSocialImage, width: 1200, height: 630, alt: `${course.title} on Growvelt` }],
    },
    twitter: { card: "summary_large_image", title: `${course.title} | Growvelt`, description, images: [defaultSocialImage] },
  };
}

export default async function PublicCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();
  const [course, locale] = await Promise.all([getPublishedLearningCourse(slug), getRequestLocale()]);
  if (!course) notFound();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const related = await getRelatedLearningCourses(course);
  const copy = coursePresentationCopy[locale];

  const activityCount = course.modules.reduce((total, module) => total + module.lessons.filter((lesson) => lesson.type !== "project").length, 0);
  const description = courseDescription(course);
  const pricing = course.isFree ? t("catalog.free") : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;
  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description,
    url: absoluteLearningUrl(`/courses/${encodeURIComponent(course.slug)}`),
    provider: { "@type": "Organization", name: "Growvelt Technologies Limited", url: absoluteLearningUrl() },
    educationalLevel: course.level || t("catalog.allLevels"),
    inLanguage: "en",
    isAccessibleForFree: course.isFree,
  };

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className={`published-course-page section-shell ${styles.page}`}>
        <CourseDetailHeader course={course} />
        <div className="published-course-layout">
          <article className="published-course-content">
            <section id="course-about"><p className="eyebrow">{t("catalog.courseOverview")}</p><h2>{t("catalog.about")}</h2><p className="published-course-description">{course.description || description}</p></section>
            <section id="course-outline">
              <div className="published-outline-heading"><div><p className="eyebrow">{t("catalog.outline")}</p><h2>{t("catalog.whatExplore")}</h2></div><p>{activityCount} {activityCount === 1 ? t("catalog.activity") : t("catalog.activities")}</p></div>
              {course.modules.length === 0 ? <p className="published-outline-empty">{t("catalog.outlinePreparing")}</p> : <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}>
                <h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>
                {module.lessons.length ? <ol>{module.lessons.map((lesson, lessonIndex) => <li className={`published-outline-lesson is-${lesson.type}`} key={lesson.id}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lessonLabel(locale, lesson.type)}</small></li>)}</ol> : <p className="published-outline-empty">{t("catalog.noLessons")}</p>}
              </li>)}</ol>}
            </section>
          </article>
          <aside id="course-access" className="published-course-aside">
            <p className="eyebrow">{t("catalog.accessTitle")}</p>
            <h2>{pricing}</h2>
            <p>{course.isFree ? t("catalog.freeAccessCopy") : copy.options}</p>
            <Link className="button button-primary" href={`/sign-up?next=${encodeURIComponent(`/dashboard/courses/${course.slug}`)}`}>{course.isFree ? t("catalog.createEnroll") : t("catalog.createAccount")}</Link>
            <Link className="text-link" href="/learn">{t("catalog.browseMore")}</Link>
          </aside>
        </div>
        <div className={styles.recommendations} id="course-recommendations">{related.length ? <CourseShelf title={copy.recommendations} description={copy.related} courses={related} /> : <Link className="text-link" href="/learn">{copy.back} →</Link>}</div>
      </section>
    </main>
    <FooterWrapper />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd).replace(/</g, "\\u003c") }} />
  </div>;
}
