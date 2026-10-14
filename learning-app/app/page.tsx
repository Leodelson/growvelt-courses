import { PublicHome } from "@/app/components/public/public-home";
import { listPublishedLearningCourses, type PublishedCourse } from "@/app/lib/catalog/published-courses";

export default async function HomePage() {
  let courses: PublishedCourse[] = [];
  try {
    courses = (await listPublishedLearningCourses()).slice(0, 3);
  } catch {
    // The optional shelf never substitutes sample records for unavailable courses.
  }
  return <PublicHome courses={courses} />;
}
