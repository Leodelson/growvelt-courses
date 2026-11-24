"use client";

import { EllipsisVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function CardActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  function close(restoreFocus: boolean) {
    if (!menuRef.current?.open) return;
    menuRef.current.open = false;
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) close(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <details className="card-action-menu" ref={menuRef} onToggle={(event) => setOpen(event.currentTarget.open)} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close(false);
  }}>
    <summary ref={triggerRef} aria-label={label}><EllipsisVertical aria-hidden="true" size={20} /></summary>
    <div className="card-action-menu-panel" onClickCapture={(event) => {
      const action = event.target instanceof Element && event.target.closest("a, button:not(:disabled)");
      if (action) close(true);
    }}>
      {children}
    </div>
  </details>;
}
