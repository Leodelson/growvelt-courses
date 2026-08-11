import Link from "next/link";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "My Learning" };

export default async function MyLearningPage() {
  const courses = await listOwnLearningEnrollments();

  if (courses.length === 0) {
    return <section className="certificate-space" aria-labelledby="my-learning-title"><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses will appear here.</h1><p>Enroll in a published free course to add it here. Lesson playback and progress are coming in the next learning checkpoint.</p><div className="certificate-space-actions"><Link className="button button-primary" href="/dashboard/explore">Explore published courses</Link><Link className="text-link" href="/dashboard">Back to dashboard <span aria-hidden="true">→</span></Link></div></section>;
  }

  return <section className="my-learning-page section-shell" aria-labelledby="my-learning-title"><header className="catalog-hero"><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses</h1><p>Your learning space is ready. Lesson playback and progress will arrive in the next checkpoint.</p></header><div className="my-learning-list">{courses.map((course) => <article className="my-learning-card" key={course.id}><div><p className="eyebrow">{course.category || "Growvelt Learning"}</p><h2>{course.title}</h2><p>{course.summary || "A practical Growvelt Learning course."}</p><div className="published-course-meta"><span>{course.level || "All levels"}</span><span>Free</span><span>{course.instructorName ? `By ${course.instructorName}` : "Growvelt Instructor"}</span></div><small>Enrolled {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(course.enrolledAt))}</small></div><Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(course.slug)}`}>Continue learning</Link></article>)}</div></section>;
}
