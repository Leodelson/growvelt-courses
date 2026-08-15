"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

export function SaveCourseButton({ courseId, isSaved, authenticated, signInHref = "/sign-up", onSavedChange }: { courseId: number; isSaved: boolean; authenticated: boolean; signInHref?: string; onSavedChange?: (isSaved: boolean) => void }) {
  const [saved, setSaved] = useState(isSaved);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const label = saved ? "Remove from saved courses" : "Save course";

  if (!authenticated) {
    return <Link className="save-course-button" href={signInHref} aria-label="Sign in to save this course" title="Sign in to save this course"><Heart size={19} strokeWidth={2} /></Link>;
  }

  async function toggleSave() {
    if (pending) return;
    setPending(true);
    setErrorMessage("");
    const { data, error } = await createClient().rpc("toggle_own_learning_course_save", { p_course_id: courseId });
    const next = (data ?? [])[0] as { is_saved: boolean } | undefined;
    if (!error && next) {
      setSaved(next.is_saved);
      onSavedChange?.(next.is_saved);
    }
    else setErrorMessage("Could not update saved courses. Please try again.");
    setPending(false);
  }

  return <span className="save-course-control"><button className={`save-course-button${saved ? " is-saved" : ""}`} type="button" aria-label={label} aria-pressed={saved} title={label} disabled={pending} onClick={() => void toggleSave()}><Heart size={19} strokeWidth={2} fill={saved ? "currentColor" : "none"} /></button>{errorMessage ? <span className="save-course-error" role="status">{errorMessage}</span> : null}</span>;
}
