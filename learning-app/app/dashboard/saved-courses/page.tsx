import { SavedCoursesList } from "@/app/components/learning/saved-courses-list";
import { listOwnSavedLearningCourses } from "@/app/lib/learning/saved-courses";

export const metadata = { title: "Saved courses" };

export default async function SavedCoursesPage() {
  return <SavedCoursesList courses={await listOwnSavedLearningCourses()} />;
}
