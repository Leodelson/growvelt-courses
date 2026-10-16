import type { Certificate } from "./certificates";
import { courseProgress, type LearnerCourse } from "./workspace";

export function learningOverview(courses: LearnerCourse[], certificates: Certificate[]) {
  const ongoing = courses.filter((course) => course.enrollmentStatus !== "completed");
  const resumable = ongoing.find((course) => course.resumeLessonId !== null);
  const featured = resumable ?? ongoing[0] ?? courses[0] ?? null;
  const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const total = courses.reduce((sum, course) => sum + count(course.totalLessons), 0);
  const done = courses.reduce((sum, course) => sum + Math.min(count(course.completedLessons), count(course.totalLessons)), 0);
  const issued = certificates.filter((certificate) => certificate.status === "issued").sort((a, b) => (Date.parse(b.issuedAt) || 0) - (Date.parse(a.issuedAt) || 0));
  const subjects = new Map<string, number>();
  for (const course of courses) if (course.category?.trim()) subjects.set(course.category.trim(), (subjects.get(course.category.trim()) ?? 0) + 1);
  return {
    featured, ongoing, completed: courses.length - ongoing.length,
    active: ongoing.filter((course) => courseProgress(course) > 0).length,
    ready: ongoing.filter((course) => courseProgress(course) === 0).length,
    total, done, overall: total ? Math.round(done / total * 100) : 0, issued,
    subjects: [...subjects].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4),
  };
}

// Keep parent sections selected on detail routes, without selecting both Home
// and every child or both course creation and the instructor's course list.
export function isDashboardNavigationCurrent(pathname: string, href: string) {
  if (["/dashboard", "/dashboard/instructor", "/dashboard/instructor/courses/new"].includes(href)) return pathname === href;
  if (href === "/dashboard/instructor/courses") return pathname === href || /^\/dashboard\/instructor\/courses\/\d+(?:\/|$)/.test(pathname);
  if (href === "/dashboard/explore" && pathname.startsWith("/dashboard/courses/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
