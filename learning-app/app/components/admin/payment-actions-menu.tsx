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
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const updatePlacement = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const spaceBelow = window.innerHeight - trigger.bottom - 8;
      const spaceAbove = trigger.top - 8;
      setPlacement(panel.offsetHeight > spaceBelow && spaceAbove > spaceBelow ? "top" : "bottom");
      const naturalLeft = trigger.right - panel.offsetWidth;
      const safeLeft = Math.min(
        Math.max(16, naturalLeft),
        Math.max(16, window.innerWidth - panel.offsetWidth - 16),
      );
      setHorizontalOffset(safeLeft - naturalLeft);
    };
    updatePlacement();
    const observer = new ResizeObserver(updatePlacement);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="payment-actions-menu" data-placement={placement}>
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
      <div
        ref={panelRef}
        id={panelId}
        className="payment-actions-panel"
        hidden={!open}
        style={{ transform: `translateX(${horizontalOffset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
