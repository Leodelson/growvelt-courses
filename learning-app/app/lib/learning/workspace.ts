import type { listOwnLearningEnrollments } from "./enrollments";
import type { PublishedCourse } from "../catalog/published-courses";

export type LearnerCourse = Awaited<ReturnType<typeof listOwnLearningEnrollments>>[number];
export type LearningFilter = "all" | "active" | "ready" | "completed";
export type LearningSort = "recent" | "progress" | "title";

export function courseProgress(course: Pick<LearnerCourse, "progressPercent">) {
  return Math.max(0, Math.min(100, Number(course.progressPercent) || 0));
}

export function filterLearningCourses(courses: LearnerCourse[], search: string, filter: LearningFilter, sort: LearningSort) {
  const query = search.trim().toLocaleLowerCase();
  return courses.filter((course) => {
    const matches = !query || [course.title, course.category, course.instructorName].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
    return matches && (filter === "all" || (filter === "completed" ? course.enrollmentStatus === "completed" : course.enrollmentStatus !== "completed" && (filter === "ready" ? courseProgress(course) === 0 : courseProgress(course) > 0)));
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "progress" ? courseProgress(b) - courseProgress(a) || a.title.localeCompare(b.title) : Date.parse(b.enrolledAt) - Date.parse(a.enrolledAt) || a.id - b.id);
}

export function learningCourseHref(course: LearnerCourse) {
  const base = `/dashboard/my-learning/${encodeURIComponent(course.slug)}`;
  return course.enrollmentStatus !== "completed" && course.resumeLessonId !== null ? `${base}/lessons/${course.resumeLessonId}` : base;
}

export function filterSavedCourses(courses: PublishedCourse[], search: string, category: string, access: string, sort: string) {
  const query = search.trim().toLocaleLowerCase();
  return courses.filter((course) => (!query || [course.title, course.category, course.instructorName].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)) && (!category || course.category === category) && (access === "all" || course.isFree === (access === "free")))
    .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "free" ? Number(b.isFree) - Number(a.isFree) : 0);
}
