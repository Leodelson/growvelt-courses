"use client";

import Link from "next/link";
import { Archive, EllipsisVertical, Eye, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
import type { CourseStatus } from "@/app/lib/instructor/course-options";
import { useLanguage } from "@/app/components/language-provider";

type PendingAction = "archive" | "restore" | "delete" | null;

export function InstructorCourseActions({ courseId, status, title }: { courseId: number; status: CourseStatus; title: string }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { actions: "Actions pour", edit: "Modifier le brouillon", view: "Voir le cours", archive: "Archiver le cours", restore: "Restaurer le cours", remove: "Supprimer le brouillon", archiveTitle: "Archiver ce cours ?", restoreTitle: "Restaurer ce cours ?", deleteTitle: "Supprimer ce brouillon ?", archiving: "Archivage…", restoring: "Restauration…", deleting: "Suppression…" } : locale === "es" ? { actions: "Acciones para", edit: "Editar borrador", view: "Ver curso", archive: "Archivar curso", restore: "Restaurar curso", remove: "Eliminar borrador", archiveTitle: "¿Archivar este curso?", restoreTitle: "¿Restaurar este curso?", deleteTitle: "¿Eliminar este borrador?", archiving: "Archivando…", restoring: "Restaurando…", deleting: "Eliminando…" } : { actions: "Actions for", edit: "Edit draft", view: "View course", archive: "Archive course", restore: "Restore course", remove: "Delete draft", archiveTitle: "Archive this course?", restoreTitle: "Restore this course?", deleteTitle: "Delete this draft?", archiving: "Archiving…", restoring: "Restoring…", deleting: "Deleting…" };
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
      <summary aria-label={`${text.actions} ${title}`}><EllipsisVertical aria-hidden="true" size={20} /></summary>
      <div className="card-action-menu-panel">
        <Link href={detailHref}>{status === "draft" ? <><Pencil aria-hidden="true" size={16} />{text.edit}</> : <><Eye aria-hidden="true" size={16} />{text.view}</>}</Link>
        {status === "published" && <button type="button" onClick={() => requestAction("archive")}><Archive aria-hidden="true" size={16} />{text.archive}</button>}
        {status === "archived" && <button type="button" onClick={() => requestAction("restore")}><RotateCcw aria-hidden="true" size={16} />{text.restore}</button>}
        {status === "draft" && <button className="is-danger" type="button" onClick={() => requestAction("delete")}><Trash2 aria-hidden="true" size={16} />{text.remove}</button>}
      </div>
    </details>
    {action && <ConfirmationDialog
      title={action === "archive" ? text.archiveTitle : action === "restore" ? text.restoreTitle : text.deleteTitle}
      description={<p>{action === "archive" ? `“${title}” will no longer appear in the public catalog or accept new learners. Existing learning records stay protected.` : action === "restore" ? `“${title}” will return to the published catalog and can accept new learners again.` : `This permanently removes “${title}” and its draft curriculum. This cannot be undone.`}</p>}
      confirmLabel={action === "archive" ? text.archive : action === "restore" ? text.restore : text.remove}
      pendingLabel={action === "archive" ? text.archiving : action === "restore" ? text.restoring : text.deleting}
      tone={action === "delete" ? "danger" : "primary"}
      isPending={isPending}
      onCancel={() => !isPending && setAction(null)}
      onConfirm={confirmAction}
    />}
  </div>;
}
