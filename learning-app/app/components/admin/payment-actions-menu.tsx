"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";

export function PaymentActionsMenu({
  orderReference,
  children,
}: {
  orderReference: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `payment-actions-${orderReference}`;

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);

    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const row = menuRef.current?.closest(".admin-application-row");
    row?.classList.toggle("payment-actions-row-open", open);
    return () => row?.classList.remove("payment-actions-row-open");
  }, [open]);

  return (
    <div ref={menuRef} className="payment-actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="payment-actions-trigger"
        aria-label={`More actions for order ${orderReference}`}
        aria-expanded={open}
        aria-controls={panelId}
        title="Order actions"
        onClick={() => setOpen((current) => !current)}
      >
        <EllipsisVertical size={20} aria-hidden="true" />
      </button>
      <div id={panelId} className="payment-actions-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
