"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/lib/supabase/server";

export async function saveCourseRating(courseId: number, rating: number) {
  if (!Number.isSafeInteger(courseId) || courseId < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from 1 to 5." };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Please sign in again to rate this course." };
  const { error } = await client.rpc("rate_own_learning_course", { p_course_id: courseId, p_rating: rating });
  if (error) return { error: error.code === "42501" ? "An eligible learner enrollment is required to rate this course." : "Your rating could not be saved. Please try again." };
  revalidatePath("/learn");
  revalidatePath("/dashboard/explore");
  revalidatePath("/courses/[slug]", "page");
  revalidatePath("/dashboard/courses/[slug]", "page");
  return { saved: true };
}
