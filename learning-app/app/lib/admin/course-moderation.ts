import { createClient } from "@/app/lib/supabase/server";

type RpcError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function throwAdminCourseReaderError(message: string, error: RpcError): never {
  if (process.env.NODE_ENV !== "production") {
    const diagnostic = {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    };
    console.error("Growvelt Learning Admin course reader RPC failed", diagnostic);
    throw new Error(`${message} ${JSON.stringify(diagnostic)}`);
  }

  throw new Error(message);
}

export type PendingCourse = {
  course_id: number;
  course_title: string;
  instructor_name: string | null;
  instructor_email: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
  submitted_at: string | null;
  total_courses?: number;
};

export type CourseReviewLesson = {
  id: number;
  title: string;
  type: "video" | "text" | "quiz";
  content: string | null;
  videoProvider: string | null;
  videoReference: string | null;
  videoVisibility: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
  position: number;
  quiz: CourseReviewQuiz | null;
};

export type CourseReviewQuiz = {
  id: number;
  instructions: string | null;
  passingPercentage: number;
  questions: Array<{
    id: number;
    text: string;
    position: number;
    options: Array<{ id: number; text: string; position: number; isCorrect: boolean }>;
  }>;
};

export type CourseReviewSnapshot = {
  courseId: number;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  isFree: boolean;
  priceAmount: number | null;
  priceCurrency: string | null;
  status: "pending_review";
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  instructor: { id: string | null; name: string | null; email: string | null };
  declaration: { version: string | null; basis: string | null; acceptedAt: string | null };
  modules: Array<{ id: number; title: string; position: number; lessons: CourseReviewLesson[] }>;
};

type ReviewRow = {
  course_id: number;
  course_title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
  course_status: "pending_review";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  declaration_version: string | null;
  rights_basis: string | null;
  declaration_accepted_at: string | null;
  module_id: number | null;
  module_title: string | null;
  module_position: number | null;
  lesson_id: number | null;
  lesson_title: string | null;
  lesson_type: "video" | "text" | "quiz" | null;
  lesson_content: string | null;
  video_provider: string | null;
  video_reference: string | null;
  video_visibility: string | null;
  duration_seconds: number | null;
  is_preview: boolean | null;
  lesson_position: number | null;
};

type QuizReviewRow = {
  course_id: number;
  lesson_id: number;
  quiz_id: number;
  instructions: string | null;
  passing_percentage: number;
  question_id: number;
  question_text: string;
  question_position: number;
  option_id: number;
  option_text: string;
  option_position: number;
  is_correct: boolean;
};

export async function getPendingLearningCourses() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_pending_learning_courses", { p_limit: 20, p_offset: 0 });
  if (error) throwAdminCourseReaderError("Unable to load submitted courses.", error);
  return (data ?? []) as PendingCourse[];
}

export async function searchPendingLearningCourses(query: string, category: string, level: string, page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.min(page, 100000) : 1;
  const { data, error } = await (await createClient()).rpc("search_pending_learning_courses", {
    p_query: query || null,
    p_category: category || null,
    p_level: level || null,
    p_limit: 12,
    p_offset: (safePage - 1) * 12,
  });
  if (error) throwAdminCourseReaderError("Unable to search submitted courses.", error);
  const courses = (data ?? []) as PendingCourse[];
  return { courses, total: courses[0]?.total_courses ?? 0, page: safePage, pageSize: 12 };
}

export async function getLearningCourseForReview(courseId: number): Promise<CourseReviewSnapshot | null> {
  const supabase = await createClient();
  const [courseResult, quizResult] = await Promise.all([
    supabase.rpc("get_learning_course_for_review", { p_course_id: courseId }),
    supabase.rpc("get_learning_course_quiz_for_review", { p_course_id: courseId }),
  ]);
  if (courseResult.error) throwAdminCourseReaderError("Unable to load this submitted course.", courseResult.error);
  if (quizResult.error) throwAdminCourseReaderError("Unable to load this course’s quiz structure.", quizResult.error);

  const data = courseResult.data;
  const rows = (data ?? []) as ReviewRow[];
  const first = rows[0];
  if (!first) return null;

  const quizRows = (quizResult.data ?? []) as QuizReviewRow[];
  const quizzes = new Map<number, CourseReviewQuiz>();
  for (const row of quizRows) {
    const quiz = quizzes.get(row.lesson_id) ?? { id: row.quiz_id, instructions: row.instructions, passingPercentage: row.passing_percentage, questions: [] };
    let question = quiz.questions.find((item) => item.id === row.question_id);
    if (!question) {
      question = { id: row.question_id, text: row.question_text, position: row.question_position, options: [] };
      quiz.questions.push(question);
    }
    question.options.push({ id: row.option_id, text: row.option_text, position: row.option_position, isCorrect: row.is_correct });
    quizzes.set(row.lesson_id, quiz);
  }

  const modules = new Map<number, CourseReviewSnapshot["modules"][number]>();
  for (const row of rows) {
    if (row.module_id === null || row.module_title === null) continue;
    const courseModule = modules.get(row.module_id) ?? { id: row.module_id, title: row.module_title, position: row.module_position ?? 0, lessons: [] };
    if (row.lesson_id !== null && row.lesson_title !== null && row.lesson_type && ["video", "text", "quiz"].includes(row.lesson_type)) {
      courseModule.lessons.push({ id: row.lesson_id, title: row.lesson_title, type: row.lesson_type, content: row.lesson_content, videoProvider: row.video_provider, videoReference: row.video_reference, videoVisibility: row.video_visibility, durationSeconds: row.duration_seconds, isPreview: Boolean(row.is_preview), position: row.lesson_position ?? 0, quiz: quizzes.get(row.lesson_id) ?? null });
    }
    modules.set(row.module_id, courseModule);
  }

  return { courseId: first.course_id, title: first.course_title, summary: first.summary, description: first.description, category: first.category, level: first.level, isFree: first.is_free, priceAmount: first.price_amount, priceCurrency: first.price_currency, status: first.course_status, submittedAt: first.submitted_at, reviewedAt: first.reviewed_at, reviewedBy: first.reviewed_by, reviewNote: first.review_note, instructor: { id: first.instructor_id, name: first.instructor_name, email: first.instructor_email }, declaration: { version: first.declaration_version, basis: first.rights_basis, acceptedAt: first.declaration_accepted_at }, modules: [...modules.values()] };
}
