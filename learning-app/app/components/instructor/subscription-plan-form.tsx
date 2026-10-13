"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import type { InstructorSubscriptionPlanCourse } from "@/app/lib/instructor/subscription-plans";
import { createOwnSubscriptionPlan, type SubscriptionPlanActionState } from "@/app/dashboard/instructor/subscriptions/actions";
import styles from "./subscription-plans.module.css";

const initialState: SubscriptionPlanActionState = { status: "idle", message: "", planId: null };

export function SubscriptionPlanForm({ courses }: { courses: InstructorSubscriptionPlanCourse[] }) {
  const [state, formAction] = useActionState(createOwnSubscriptionPlan, initialState);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.planId) router.refresh();
  }, [router, state.planId, state.status]);

  function changeCourseSelection(courseId: number, checked: boolean) {
    const nextIds = checked ? [...selectedIds, courseId] : selectedIds.filter((id) => id !== courseId);
    const termVersions = new Set(nextIds.map((id) => courses.find((course) => course.course_id === id)?.commercial_terms_version));
    if (termVersions.size > 1) {
      setSelectionMessage("Courses with different commercial terms need separate plans.");
      return;
    }
    setSelectionMessage("");
    setSelectedIds(nextIds);
  }

  return <section className={styles.panel}>
    <header className={styles.panelHeader}>
      <p className="eyebrow">New monthly plan</p>
      <h2>Create a draft for your course catalog</h2>
      <p>Choose your published paid courses and set the monthly price in naira. Saving a draft never contacts Paystack; Test Mode plan setup is a separate, gated action.</p>
    </header>
    <form action={formAction} className={styles.form}>
      <label className="course-field">Plan name<input name="name" minLength={3} maxLength={100} placeholder="For example, Design Essentials" required /></label>
      <label className="course-field">Monthly price (NGN)<input name="monthly_price" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="15000.00" required /><span>Saved internally in kobo. One-time course prices and purchases remain unchanged.</span></label>
      <label className={`course-field ${styles.fullWidth}`}>Description (optional)<textarea name="description" rows={3} maxLength={1000} placeholder="Explain what learners get with this monthly plan." /></label>

      <fieldset className={styles.coursePicker}>
        <legend>Courses included</legend>
        <p>Select between 1 and 50 of your eligible courses. A plan can include courses with the same commercial terms.</p>
        {courses.length ? <div className={styles.courseList}>{courses.map((course) => <label className={styles.courseOption} key={course.course_id}>
          <input type="checkbox" name="course_ids" value={course.course_id} checked={selectedIds.includes(course.course_id)} onChange={(event) => changeCourseSelection(course.course_id, event.target.checked)} />
          <span><strong>{course.title}</strong><small>{new Intl.NumberFormat("en-NG", { style: "currency", currency: course.currency, minimumFractionDigits: 2 }).format(course.price_amount)}</small></span>
        </label>)}</div> : <p className={styles.emptyCourses}>No eligible published paid courses yet. Courses must be public, NGN-priced, and published under your instructor account.</p>}
        {selectionMessage && <p className={styles.selectionNotice} role="status">{selectionMessage}</p>}
      </fieldset>

      <div className={styles.formFooter}>
        <ActionSubmitButton label="Save draft plan" pendingLabel="Saving draft…" />
        <p>This only saves a private draft. It does not create a Paystack plan, start a subscription, or charge anyone.</p>
      </div>
      {state.message && <p className={`${styles.feedback} ${state.status === "error" ? styles.error : styles.success}`} role="status">{state.message}</p>}
    </form>
  </section>;
}
