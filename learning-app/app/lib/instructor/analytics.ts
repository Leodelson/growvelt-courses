import { createClient } from "@/app/lib/supabase/server";

type InstructorAnalyticsRow = {
  course_id: number;
  course_title: string;
  course_status: "draft" | "pending_review" | "published" | "archived";
  enrolled_learner_count: number;
  active_learner_count: number;
  completed_learner_count: number;
  completion_rate: number;
  quiz_count: number;
  quiz_attempt_count: number;
  quiz_passed_attempt_count: number;
  quiz_attempt_pass_rate: number;
  average_quiz_score: number;
  last_enrolled_at: string | null;
};

export type InstructorLearningAnalytics = {
  courses: Array<{
    courseId: number;
    title: string;
    status: InstructorAnalyticsRow["course_status"];
    enrolledLearnerCount: number;
    activeLearnerCount: number;
    completedLearnerCount: number;
    completionRate: number;
    quizCount: number;
    quizAttemptCount: number;
    quizPassedAttemptCount: number;
    quizAttemptPassRate: number;
    averageQuizScore: number;
    lastEnrolledAt: string | null;
  }>;
  totalEnrolledLearners: number;
  totalCompletedLearners: number;
  overallCompletionRate: number;
  totalQuizAttempts: number;
};

export async function getOwnInstructorLearningAnalytics(): Promise<InstructorLearningAnalytics> {
  const { data, error } = await (await createClient()).rpc("get_own_instructor_learning_analytics");
  if (error) throw new Error("Unable to load Instructor Learning Analytics.");

  const courses = ((data ?? []) as InstructorAnalyticsRow[]).map((row) => ({
    courseId: row.course_id,
    title: row.course_title,
    status: row.course_status,
    enrolledLearnerCount: row.enrolled_learner_count,
    activeLearnerCount: row.active_learner_count,
    completedLearnerCount: row.completed_learner_count,
    completionRate: row.completion_rate,
    quizCount: row.quiz_count,
    quizAttemptCount: row.quiz_attempt_count,
    quizPassedAttemptCount: row.quiz_passed_attempt_count,
    quizAttemptPassRate: row.quiz_attempt_pass_rate,
    averageQuizScore: row.average_quiz_score,
    lastEnrolledAt: row.last_enrolled_at,
  }));

  const totalEnrolledLearners = courses.reduce((total, course) => total + course.enrolledLearnerCount, 0);
  const totalCompletedLearners = courses.reduce((total, course) => total + course.completedLearnerCount, 0);

  return {
    courses,
    totalEnrolledLearners,
    totalCompletedLearners,
    overallCompletionRate: totalEnrolledLearners === 0 ? 0 : Math.round((totalCompletedLearners / totalEnrolledLearners) * 100),
    totalQuizAttempts: courses.reduce((total, course) => total + course.quizAttemptCount, 0),
  };
}
