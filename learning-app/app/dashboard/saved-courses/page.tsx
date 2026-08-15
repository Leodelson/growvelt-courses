import Link from "next/link";
import { SavedCoursesList } from "@/app/components/learning/saved-courses-list";
import { listOwnSavedLearningCourses } from "@/app/lib/learning/saved-courses";

export const metadata = { title: "Saved courses" };

export default async function SavedCoursesPage() {
  const courses = await listOwnSavedLearningCourses();

  return <section className="saved-courses-page section-shell">
    <header className="saved-courses-hero">
      <div><p className="eyebrow">Saved courses</p><h1>Your private course shortlist.</h1><p>Courses you save appear here, ready whenever you want to revisit or enroll.</p></div>
      <Link className="button button-primary" href="/dashboard/explore">Explore catalog</Link>
    </header>
    <SavedCoursesList courses={courses} />
  </section>;
}
