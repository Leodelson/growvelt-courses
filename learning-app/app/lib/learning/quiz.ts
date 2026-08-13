import { createClient } from "@/app/lib/supabase/server";

type QuizSnapshotRow = {
  course_id: number;
  course_slug: string;
  lesson_id: number;
  lesson_title: string;
  quiz_id: number;
  instructions: string | null;
  passing_percentage: number;
  question_id: number;
  question_text: string;
  question_position: number;
  option_id: number;
  option_text: string;
  option_position: number;
  latest_attempt_submitted_at: string | null;
  latest_attempt_score_percentage: number | null;
  latest_attempt_passed: boolean | null;
  attempt_count: number;
};

export type QuizAnswerSelection = {
  questionId: number;
  optionId: number;
};

export type QuizAttemptResult = {
  attemptId: number;
  submittedAt: string;
  scorePercentage: number;
  passed: boolean;
  correctAnswerCount: number;
  totalQuestionCount: number;
};

export type EnrolledQuizSnapshot = {
  course: { id: number; slug: string };
  lesson: { id: number; title: string };
  quiz: {
    id: number;
    instructions: string | null;
    passingPercentage: number;
    questions: Array<{
      id: number;
      text: string;
      options: Array<{ id: number; text: string }>;
    }>;
    latestAttempt: {
      submittedAt: string;
      scorePercentage: number;
      passed: boolean;
    } | null;
    attemptCount: number;
  };
};

/**
 * Learner-safe assessment data only. Correct-answer state is intentionally not
 * represented here; the database scores submitted option IDs server-side.
 */
export async function getOwnEnrolledQuizSnapshot(slug: string, lessonId: number): Promise<EnrolledQuizSnapshot | null> {
  const { data, error } = await (await createClient()).rpc("get_own_enrolled_quiz_snapshot", {
    p_slug: slug,
    p_lesson_id: lessonId,
  });
  if (error) throw new Error("Unable to load this quiz.");

  const rows = (data ?? []) as QuizSnapshotRow[];
  const first = rows[0];
  if (!first) return null;

  const questions = new Map<number, EnrolledQuizSnapshot["quiz"]["questions"][number]>();
  for (const row of rows) {
    const question = questions.get(row.question_id) ?? { id: row.question_id, text: row.question_text, options: [] };
    question.options.push({ id: row.option_id, text: row.option_text });
    questions.set(row.question_id, question);
  }

  return {
    course: { id: first.course_id, slug: first.course_slug },
    lesson: { id: first.lesson_id, title: first.lesson_title },
    quiz: {
      id: first.quiz_id,
      instructions: first.instructions,
      passingPercentage: first.passing_percentage,
      questions: [...questions.values()],
      latestAttempt: first.latest_attempt_submitted_at === null || first.latest_attempt_score_percentage === null || first.latest_attempt_passed === null
        ? null
        : { submittedAt: first.latest_attempt_submitted_at, scorePercentage: first.latest_attempt_score_percentage, passed: first.latest_attempt_passed },
      attemptCount: first.attempt_count,
    },
  };
}

export function toQuizAnswerPayload(answers: readonly QuizAnswerSelection[]) {
  return answers.map(({ questionId, optionId }) => ({ question_id: questionId, option_id: optionId }));
}

export function mapQuizAttemptResult(row: {
  attempt_id: number;
  submitted_at: string;
  score_percentage: number;
  passed: boolean;
  correct_answer_count: number;
  total_question_count: number;
}): QuizAttemptResult {
  return {
    attemptId: row.attempt_id,
    submittedAt: row.submitted_at,
    scorePercentage: row.score_percentage,
    passed: row.passed,
    correctAnswerCount: row.correct_answer_count,
    totalQuestionCount: row.total_question_count,
  };
}
