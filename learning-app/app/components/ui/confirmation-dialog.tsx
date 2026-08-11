"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ActionButton } from "@/app/components/ui/action-button";

type ConfirmationDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  isPending?: boolean;
  pendingLabel?: string;
  tone?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({ title, description, confirmLabel, isPending = false, pendingLabel, tone = "primary", onCancel, onConfirm }: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !isPending) { event.preventDefault(); onCancel(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="review-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onCancel(); }}>
    <div className="review-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title" aria-describedby="confirmation-dialog-description" onKeyDown={handleKeyDown}>
      <p className="eyebrow">Confirm action</p>
      <h2 id="confirmation-dialog-title">{title}</h2>
      <div id="confirmation-dialog-description">{description}</div>
      <div className="review-dialog-actions">
        <button ref={cancelRef} className="button button-secondary" type="button" onClick={onCancel} disabled={isPending}>Cancel</button>
        <ActionButton className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`} type="button" onClick={onConfirm} isPending={isPending} pendingLabel={pendingLabel}>{confirmLabel}</ActionButton>
      </div>
    </div>
  </div>;
}
