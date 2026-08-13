"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import { courseCategories, courseLevels, type CourseStatus } from "@/app/lib/instructor/course-options";

type CourseValues = {
  title: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
};

type CourseDraftFormProps = {
  mode: "create" | "edit";
  courseId?: number;
  initialValues?: CourseValues;
  status?: CourseStatus;
};

const defaultValues: CourseValues = {
  title: "",
  summary: "",
  description: "",
  category: "Data Analytics",
  level: "Beginner",
  is_free: true,
  price_amount: null,
  price_currency: "NGN",
};

function getSafePrice(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CourseDraftForm({ mode, courseId, initialValues = defaultValues, status = "draft" }: CourseDraftFormProps) {
  const router = useRouter();
  const [isFree, setIsFree] = useState(initialValues.is_free);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ variant: "error" | "success" | "info"; message: string } | null>(null);
  const isEditable = status === "draft";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !isEditable) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const summary = String(form.get("summary") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const level = String(form.get("level") ?? "");
    const priceAmount = isFree ? 0 : getSafePrice(form.get("price_amount"));

    if (title.length < 3 || summary.length < 10 || description.length < 40 || (!isFree && (!priceAmount || priceAmount <= 0))) {
      setFeedback({ variant: "error", message: "Complete the required metadata and provide a valid NGN price for a paid draft." });
      return;
    }

    setFeedback(null);
    setIsPending(true);

    try {
      const supabase = createClient();
      const input = {
        p_title: title,
        p_summary: summary,
        p_description: description,
        p_category: category,
        p_level: level,
        p_is_free: isFree,
        p_price_amount: priceAmount,
        p_price_currency: "NGN",
      };

      if (mode === "create") {
        const { data, error } = await supabase.rpc("create_instructor_course_draft", input);
        const created = data?.[0] as { course_id?: number } | undefined;
        if (error || !created?.course_id) throw new Error("create_failed");
        router.replace(`/dashboard/instructor/courses/${created.course_id}`);
        router.refresh();
        return;
      }

      const { error } = await supabase.rpc("update_instructor_course_draft", { p_course_id: courseId, ...input });
      if (error) throw new Error("save_failed");
      setFeedback({ variant: "success", message: "Draft changes saved. This course is still private and unpublished." });
      router.refresh();
    } catch {
      setFeedback({ variant: "error", message: mode === "create" ? "We couldn’t create this draft. Review the details and try again." : "We couldn’t save these changes. Your draft has not been updated." });
    } finally {
      setIsPending(false);
    }
  }

  return <form className="course-draft-form" onSubmit={handleSubmit}>
    {!isEditable && <InlineFeedback variant="info">This course is {status.replace("_", " ")}. Its metadata is read-only for Instructors in this phase.</InlineFeedback>}
    {feedback && <InlineFeedback variant={feedback.variant}>{feedback.message}</InlineFeedback>}
    <fieldset disabled={isPending || !isEditable}>
      <label className="course-field">Course title<input name="title" defaultValue={initialValues.title} minLength={3} maxLength={160} required /><span>Use a clear, outcome-led title. Your course URL is created once and stays stable.</span></label>
      <label className="course-field">Short summary<textarea name="summary" defaultValue={initialValues.summary} minLength={10} maxLength={320} rows={3} required /><span>Shown in course discovery. Keep it focused and practical.</span></label>
      <label className="course-field">Course description<textarea name="description" defaultValue={initialValues.description} minLength={40} maxLength={10000} rows={7} required /><span>Explain the practical outcome, intended learner, and learning approach.</span></label>
      <div className="course-form-grid">
        <label className="course-field">Category<select name="category" defaultValue={initialValues.category} required>{courseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="course-field">Level<select name="level" defaultValue={initialValues.level} required>{courseLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
      </div>
      <fieldset className="course-pricing-fieldset">
        <legend>Course access</legend>
        <label className="course-choice"><input type="radio" name="access" checked={isFree} onChange={() => setIsFree(true)} />Free course<span>Eligible for review, publication, and learner enrollment when the course is complete.</span></label>
        <label className="course-choice"><input type="radio" name="access" checked={!isFree} onChange={() => setIsFree(false)} />Paid course<span>Pricing metadata only. Paid checkout and access are not enabled yet.</span></label>
        {!isFree && <label className="course-field course-price-field">Price (NGN)<input name="price_amount" type="number" min="1" max="10000000" step="0.01" defaultValue={initialValues.price_amount ?? ""} required /><span>Setting a price does not publish the course or grant learner access.</span></label>}
      </fieldset>
    </fieldset>
    {isEditable && <ActionButton className="button button-primary" type="submit" isPending={isPending} pendingLabel={mode === "create" ? "Creating draft…" : "Saving changes…"}>{mode === "create" ? "Create draft" : "Save changes"}</ActionButton>}
  </form>;
}
