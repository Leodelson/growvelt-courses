import { PublicHome } from "@/app/components/public/public-home";
import { listPublishedLearningCourses, type PublishedCourse } from "@/app/lib/catalog/published-courses";

export default async function HomePage() {
  let courses: PublishedCourse[] = [];
  let popularCourses = false;
  try {
    const publishedCourses = await listPublishedLearningCourses();
    const ratedCourses = publishedCourses.filter((course) => (course.ratingCount ?? 0) > 0)
      .sort((first, second) => (second.ratingCount ?? 0) - (first.ratingCount ?? 0) || (second.averageRating ?? 0) - (first.averageRating ?? 0));
    popularCourses = ratedCourses.length > 0;
    courses = (popularCourses ? ratedCourses : publishedCourses).slice(0, 3);
  } catch {
    // The optional shelf never substitutes sample records for unavailable courses.
  }
  return <PublicHome courses={courses} popularCourses={popularCourses} />;
}
