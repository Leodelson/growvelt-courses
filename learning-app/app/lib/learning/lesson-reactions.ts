import { createClient } from "@/app/lib/supabase/server";

export async function getOwnLearningLessonReaction(lessonId: number): Promise<number | null> {
  const { data, error } = await (await createClient()).rpc("get_own_learning_lesson_reaction", {
    p_lesson_id: lessonId,
  });
  if (error) throw new Error("Unable to load lesson feedback.");
  return data === 1 || data === -1 ? data : null;
}
