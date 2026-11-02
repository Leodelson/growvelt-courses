"use client";

import { useActionState, useEffect, useState } from "react";
import { useLanguage } from "@/app/components/language-provider";
import { workbenchCopy } from "@/app/lib/instructor/workbench";
import { useRouter } from "next/navigation";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import type { InstructorSubscriptionPlanCourse } from "@/app/lib/instructor/subscription-plans";
import { createOwnLiveSubscriptionPlan, createOwnSubscriptionPlan, type SubscriptionPlanActionState } from "@/app/dashboard/instructor/subscriptions/actions";
import styles from "./subscription-plans.module.css";

const initialState: SubscriptionPlanActionState = { status: "idle", message: "", planId: null };
const liveRequestStorageKey = "growvelt:learning:live-subscription-plan-request:v1";

export function SubscriptionPlanForm({ courses, canCreateLivePlans = false }: { courses: InstructorSubscriptionPlanCourse[]; canCreateLivePlans?: boolean }) {
  const [state, formAction] = useActionState(createOwnSubscriptionPlan, initialState);
  const [liveState, liveFormAction, isLivePending] = useActionState(createOwnLiveSubscriptionPlan, initialState);
  const { locale } = useLanguage();
  const ui = workbenchCopy[locale];
  const [courseSearch, setCourseSearch] = useState("");
  const matchesSearch = (title:string) => title.toLocaleLowerCase(locale).includes(courseSearch.trim().toLocaleLowerCase(locale));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [liveRequestId, setLiveRequestId] = useState("");
  const [planName, setPlanName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.planId) router.refresh();
  }, [router, state.planId, state.status]);

  useEffect(() => {
    if (!canCreateLivePlans) {
      // Client-only id is initialized after hydration so it cannot mismatch the server render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveRequestId(crypto.randomUUID());
      setSessionReady(true);
      return;
    }
    try {
      const saved = sessionStorage.getItem(liveRequestStorageKey);
      const parsed = saved ? JSON.parse(saved) as {
        requestId?: unknown; name?: unknown; price?: unknown; description?: unknown; courseIds?: unknown;
      } : null;
      if (typeof parsed?.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.requestId)) {
        setLiveRequestId(parsed.requestId);
        if (typeof parsed.name === "string") setPlanName(parsed.name.slice(0, 100));
        if (typeof parsed.price === "string") setMonthlyPrice(parsed.price.slice(0, 12));
        if (typeof parsed.description === "string") setPlanDescription(parsed.description.slice(0, 1000));
        if (Array.isArray(parsed.courseIds)) {
          setSelectedIds(parsed.courseIds.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && courses.some((course) => course.course_id === id)).slice(0, 50));
        }
      } else {
        setLiveRequestId(crypto.randomUUID());
      }
    } catch {
      setLiveRequestId(crypto.randomUUID());
    }
    setSessionReady(true);
  }, [canCreateLivePlans, courses]);

  useEffect(() => {
    if (liveState.status === "success" && liveState.planId) {
      router.refresh();
      const nextRequestId = crypto.randomUUID();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveRequestId(nextRequestId);
      return;
    }
    if (liveState.status === "success" || liveState.status === "notice") router.refresh();
  }, [liveState.planId, liveState.status, router]);

  useEffect(() => {
    if (!canCreateLivePlans || !sessionReady || !liveRequestId) return;
    try {
      sessionStorage.setItem(liveRequestStorageKey, JSON.stringify({
        requestId: liveRequestId, name: planName, price: monthlyPrice,
        description: planDescription, courseIds: selectedIds,
      }));
    } catch { /* session persistence is a safety enhancement, not a blocker */ }
  }, [canCreateLivePlans, liveRequestId, monthlyPrice, planDescription, planName, selectedIds, sessionReady]);

  function changeCourseSelection(courseId: number, checked: boolean) {
    const nextIds = checked ? [...selectedIds, courseId] : selectedIds.filter((id) => id !== courseId);
    const selectedCourses = nextIds.map((id) => courses.find((course) => course.course_id === id)).filter(Boolean);
    const termVersions = new Set(selectedCourses.map((course) => course?.commercial_terms_version));
    if (termVersions.size > 1) {
      setSelectionMessage("Courses with different commercial terms need separate plans.");
      return;
    }
    const courseTypes = new Set(selectedCourses.map((course) => course?.company_test_mode_only));
    if (courseTypes.size > 1) {
      setSelectionMessage("Keep organization-only courses in a separate private plan preview.");
      return;
    }
    setSelectionMessage("");
    setSelectedIds(nextIds);
  }

  return <section className={styles.panel}>
    <header className={styles.panelHeader}>
      <p className="eyebrow">New monthly plan</p>
      <h2>Create a draft for your course catalog</h2>
      <p>Choose your published paid courses and set the monthly price in naira. Plans remain private drafts until monthly checkout is made available.</p>
    </header>
    <form action={formAction} className={styles.form}>
      <label className="course-field">Plan name <span className="required-mark" aria-hidden="true">*</span><input name="name" minLength={3} maxLength={100} placeholder="For example, Design Essentials" value={planName} onChange={(event) => setPlanName(event.target.value)} required /></label>
      <label className="course-field">Monthly price (NGN) <span className="required-mark" aria-hidden="true">*</span><input name="monthly_price" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="15000.00" value={monthlyPrice} onChange={(event) => setMonthlyPrice(event.target.value)} required /><span>Saved internally in kobo. One-time course prices and purchases remain unchanged.</span></label>
      <label className={`course-field ${styles.fullWidth}`}>Description (optional)<textarea name="description" rows={3} maxLength={1000} placeholder="Explain what learners get with this monthly plan." value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} /></label>

      <fieldset className={styles.coursePicker}>
        <legend>Courses included <span className="required-mark" aria-hidden="true">*</span></legend>
        <p>Select 1 to 50 of your published paid NGN courses with the same commercial terms. Organization-only courses can be included only in a separate private preview plan and are not offered through public subscription checkout. Ineligible internal course records are excluded.</p>
        {courses.length > 0 && <><label className="course-field">{ui.findCourses}<input type="search" onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}} value={courseSearch} maxLength={120} onChange={event=>setCourseSearch(event.target.value)} /></label><p role="status">{ui.selected}: {selectedIds.length} / 50 · {ui.results}: {courses.filter(course=>matchesSearch(course.title)).length} / {courses.length}</p><p>{ui.selectionHint}</p></>}
        {courses.length ? <div className={styles.courseList}>{courses.map((course) => <label className={styles.courseOption} key={course.course_id} hidden={!matchesSearch(course.title)}>
          <input type="checkbox" name="course_ids" value={course.course_id} checked={selectedIds.includes(course.course_id)} disabled={selectedIds.length >= 50 && !selectedIds.includes(course.course_id)} onChange={(event) => changeCourseSelection(course.course_id, event.target.checked)} />
          <span><strong>{course.title}</strong><small>{new Intl.NumberFormat("en-NG", { style: "currency", currency: course.currency, minimumFractionDigits: 2 }).format(course.price_amount)}{course.company_test_mode_only ? " · Organization-only" : ""}</small></span>
        </label>)}</div> : <p className={styles.emptyCourses}>No eligible published paid courses yet. Courses must be owned by your instructor account, published, and priced above zero in NGN. Organization-only courses can be included only in a private preview plan.</p>}
        {courses.length > 0 && !courses.some(course=>matchesSearch(course.title)) && <p className={styles.emptyCourses}>{ui.noMatch}</p>}
        {selectionMessage && <p className={styles.selectionNotice} role="status">{selectionMessage}</p>}
      </fieldset>

      <div className={styles.formFooter}>
        <ActionSubmitButton label="Save draft plan" pendingLabel="Saving draft…" />
        <p>This only saves a private draft. It does not start recurring billing, charge learners, or grant course access.</p>
        {canCreateLivePlans && <>
          <input type="hidden" name="live_request_id" value={liveRequestId} />
          <button type="submit" formAction={liveFormAction} className="button" disabled={!sessionReady || !liveRequestId || isLivePending}>
            {isLivePending ? "Setting up Live plan…" : "Create Live billing plan"}
          </button>
          <p>This creates a billing plan with the payment provider. It does not start learner billing, charge learners, or grant course access. If setup is uncertain, the request is locked for administrator review instead of being retried.</p>
        </>}
      </div>
      {state.message && <p className={`${styles.feedback} ${state.status === "error" ? styles.error : styles.success}`} role="status">{state.message}</p>}
      {liveState.message && <p className={`${styles.feedback} ${liveState.status === "error" ? styles.error : liveState.status === "success" ? styles.success : styles.notice}`} role="status">{liveState.message}</p>}
    </form>
  </section>;
}
