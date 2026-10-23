import { LearningLibrary } from "@/app/components/learning/learning-library";
import { listOwnLearningEnrollments } from "@/app/lib/learning/enrollments";

export const metadata = { title: "My Courses" };

export default async function MyLearningPage() {
  return <LearningLibrary courses={await listOwnLearningEnrollments()} />;
}
