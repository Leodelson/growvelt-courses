import { PublishedCourseCard } from "@/app/components/published-course-card";
import { listPublishedLearningCourses } from "@/app/lib/catalog/published-courses";

export const metadata = { title: "Explore catalog" };

export default async function DashboardExplorePage() {
  const courses = await listPublishedLearningCourses();

  return <section className="catalog-page section-shell"><header className="catalog-hero"><p className="eyebrow">Explore Growvelt Learning</p><h1>Build practical skills, one focused course at a time.</h1><p>Browse published courses from Growvelt Instructors. Enrollment and learning progress will arrive in a later checkpoint.</p></header>{courses.length === 0 ? <section className="course-empty-state"><p className="eyebrow">Nothing published yet</p><h2>Published courses will appear here as they become available.</h2><p>Growvelt is preparing its first practical learning experiences.</p></section> : <section aria-labelledby="published-courses-title"><div className="section-heading"><div><p className="eyebrow">Published courses</p><h2 id="published-courses-title">Choose a practical place to begin.</h2></div><p className="demo-chip">Live catalog</p></div><div className="course-grid published-course-grid">{courses.map((course, index) => <PublishedCourseCard course={course} index={index} key={course.id} />)}</div></section>}</section>;
}
