"use client";

import Link from "next/link";
import { Archive, EllipsisVertical, Eye, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import type { CourseStatus } from "@/app/lib/instructor/course-options";

type PendingAction = "archive" | "restore" | "delete" | null;

export function InstructorCourseActions({ courseId, status, title }: { courseId: number; status: CourseStatus; title: string }) {
  const router = useRouter();
  const [action, setAction] = useState<PendingAction>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const detailHref = `/dashboard/instructor/courses/${courseId}`;

  useEffect(() => {
    function closeWhenOutside(event: PointerEvent) {
      if (menuRef.current?.open && event.target instanceof Node && !menuRef.current.contains(event.target)) menuRef.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) menuRef.current.open = false;
    }
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  function requestAction(nextAction: Exclude<PendingAction, null>) {
    menuRef.current?.removeAttribute("open");
    setAction(nextAction);
  }

  async function confirmAction() {
    if (!action || isPending) return;
    setIsPending(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc(
      action === "archive" ? "archive_own_instructor_course" : action === "restore" ? "restore_own_instructor_course" : "delete_own_instructor_draft",
      { p_course_id: courseId },
    );
    setIsPending(false);
    if (rpcError) {
      setAction(null);
      setError(action === "archive" ? "We couldn’t archive this course. Refresh and confirm its current status." : action === "restore" ? "We couldn’t restore this course. Refresh and try again." : "We couldn’t delete this draft. Refresh and try again.");
      return;
    }
    setAction(null);
    if (action === "archive") router.push("/dashboard/instructor/courses?status=archived");
    else router.refresh();
  }

  return <div className="instructor-course-actions">
    {error && <InlineFeedback variant="error">{error}</InlineFeedback>}
    <details className="card-action-menu" ref={menuRef}>
      <summary aria-label={`Actions for ${title}`}><EllipsisVertical aria-hidden="true" size={20} /></summary>
      <div className="card-action-menu-panel">
        <Link href={detailHref}>{status === "draft" ? <><Pencil aria-hidden="true" size={16} />Edit draft</> : <><Eye aria-hidden="true" size={16} />View course</>}</Link>
        {status === "published" && <button type="button" onClick={() => requestAction("archive")}><Archive aria-hidden="true" size={16} />Archive course</button>}
        {status === "archived" && <button type="button" onClick={() => requestAction("restore")}><RotateCcw aria-hidden="true" size={16} />Restore course</button>}
        {status === "draft" && <button className="is-danger" type="button" onClick={() => requestAction("delete")}><Trash2 aria-hidden="true" size={16} />Delete draft</button>}
      </div>
    </details>
    {action && <ConfirmationDialog
      title={action === "archive" ? "Archive this course?" : action === "restore" ? "Restore this course?" : "Delete this draft?"}
      description={<p>{action === "archive" ? `“${title}” will no longer appear in the public catalog or accept new learners. Existing learning records stay protected.` : action === "restore" ? `“${title}” will return to the published catalog and can accept new learners again.` : `This permanently removes “${title}” and its draft curriculum. This cannot be undone.`}</p>}
      confirmLabel={action === "archive" ? "Archive course" : action === "restore" ? "Restore course" : "Delete draft"}
      pendingLabel={action === "archive" ? "Archiving…" : action === "restore" ? "Restoring…" : "Deleting…"}
      tone={action === "delete" ? "danger" : "primary"}
      isPending={isPending}
      onCancel={() => !isPending && setAction(null)}
      onConfirm={confirmAction}
    />}
  </div>;
}
