import { notFound, redirect } from "next/navigation";
import { getOwnEnrolledLearningCourse } from "@/app/lib/learning/enrollments";

export const metadata = { title: "My Courses" };

export default async function EnrolledCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 220) notFound();

  const course = await getOwnEnrolledLearningCourse(slug);
  if (!course) notFound();

  const firstEligibleLesson = course.modules.flatMap((module) => module.lessons)
    .find((lesson) => lesson.type === "text" || lesson.type === "video" || lesson.type === "quiz");
  const lessonId = course.resumeLessonId ?? firstEligibleLesson?.id;

  if (lessonId) {
    redirect(`/dashboard/my-learning/${encodeURIComponent(course.slug)}/lessons/${lessonId}`);
  }

  redirect("/dashboard/my-learning");
}
