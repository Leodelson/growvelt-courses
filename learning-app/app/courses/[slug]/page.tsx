import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FooterWrapper from "@/app/components/FooterWrapper";
import { PublicHeader } from "@/app/components/public-header";
import { getPublishedLearningCourse } from "@/app/lib/catalog/published-courses";
import { absoluteLearningUrl, defaultSocialImage } from "@/app/lib/seo";

function lessonLabel(type: "video" | "text" | "quiz" | "project") {
  if (type === "video") return "Video lesson";
  if (type === "text") return "Text lesson";
  if (type === "quiz") return "Quiz";
  return "Project · Coming later";
}

function courseDescription(course: Awaited<ReturnType<typeof getPublishedLearningCourse>>) {
  if (!course) return "";
  return course.summary || course.description || "A practical Growvelt Learning course.";
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
      title: `${course.title} | Growvelt Learning`,
      description,
      images: [{ url: defaultSocialImage, width: 1200, height: 630, alt: `${course.title} on Growvelt Learning` }],
    },
    twitter: { card: "summary_large_image", title: `${course.title} | Growvelt Learning`, description, images: [defaultSocialImage] },
  };
}

export default async function PublicCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();
  const course = await getPublishedLearningCourse(slug);
  if (!course) notFound();

  const activityCount = course.modules.reduce((total, module) => total + module.lessons.filter((lesson) => lesson.type !== "project").length, 0);
  const description = courseDescription(course);
  const pricing = course.isFree ? "Free" : `${course.priceCurrency || "NGN"} ${Number(course.priceAmount ?? 0).toLocaleString("en-NG")}`;
  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description,
    url: absoluteLearningUrl(`/courses/${encodeURIComponent(course.slug)}`),
    provider: { "@type": "Organization", name: "Growvelt Technologies Limited", url: absoluteLearningUrl() },
    educationalLevel: course.level || "All levels",
    inLanguage: "en",
    isAccessibleForFree: course.isFree,
  };

  return <div className="public-page">
    <PublicHeader />
    <main>
      <section className="published-course-page section-shell">
        <header className="published-course-hero">
          <Link className="back-link" href="/learn">Explore courses</Link>
          <p className="eyebrow">{course.category || "Growvelt Learning"}</p>
          <h1>{course.title}</h1>
          <p className="published-course-summary">{description}</p>
          <div className="published-course-meta"><span>{course.level || "All levels"}</span><span>{pricing}</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div>
        </header>
        <div className="published-course-layout">
          <article className="published-course-content">
            <section><p className="eyebrow">Course overview</p><h2>About this course</h2><p className="published-course-description">{course.description || description}</p></section>
            <section>
              <div className="published-outline-heading"><div><p className="eyebrow">Course outline</p><h2>What you’ll explore</h2></div><p>{activityCount} {activityCount === 1 ? "learning activity" : "learning activities"}</p></div>
              {course.modules.length === 0 ? <p className="published-outline-empty">The course outline is being prepared.</p> : <ol className="published-outline">{course.modules.map((module, moduleIndex) => <li key={module.id}>
                <h3>{String(moduleIndex + 1).padStart(2, "0")} · {module.title}</h3>
                {module.lessons.length ? <ol>{module.lessons.map((lesson, lessonIndex) => <li className={`published-outline-lesson is-${lesson.type}`} key={lesson.id}><span>{lessonIndex + 1}. {lesson.title}</span><small>{lessonLabel(lesson.type)}</small></li>)}</ol> : <p className="published-outline-empty">No lessons have been added to this module yet.</p>}
              </li>)}</ol>}
            </section>
          </article>
          <aside className="published-course-aside">
            <p className="eyebrow">Course access</p>
            <h2>{course.isFree ? "Start learning for free" : "Paid access is coming later"}</h2>
            <p>{course.isFree ? "Create an account or sign in to enroll, continue through lessons, complete quizzes, and earn verified course progress." : "Growvelt has not enabled paid enrollment or checkout yet."}</p>
            <Link className="button button-primary" href={`/sign-up?next=${encodeURIComponent(`/dashboard/courses/${course.slug}`)}`}>{course.isFree ? "Create an account to enroll" : "Create an account"}</Link>
            <Link className="text-link" href="/learn">Browse more courses</Link>
          </aside>
        </div>
      </section>
    </main>
    <FooterWrapper />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }} />
  </div>;
}
