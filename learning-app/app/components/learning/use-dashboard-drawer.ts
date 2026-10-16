"use client";

import { useEffect, type RefObject } from "react";

export function useDashboardDrawer(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const media = window.matchMedia("(max-width: 900px)");
    if (!media.matches) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const background = [document.getElementById("main-content"), document.querySelector<HTMLElement>(".learning-sidebar"), document.querySelector<HTMLElement>(".mobile-nav")].filter((item): item is HTMLElement => Boolean(item));
    const inert = background.map((item) => item.inert);
    background.forEach((item) => { item.inert = true; });
    document.body.style.overflow = "hidden";
    const focusable = () => [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter((item) => item.getClientRects().length > 0);
    (panel.querySelector<HTMLElement>("[data-drawer-close]") ?? focusable()[0])?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel?.focus(); return; }
      if (!panel?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    }
    function onResize() { if (!media.matches) close(); }
    document.addEventListener("keydown", handleKey);
    media.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", handleKey);
      media.removeEventListener("change", onResize);
      document.body.style.overflow = overflow;
      background.forEach((item, index) => { item.inert = inert[index]; });
      if (previous?.isConnected && media.matches) previous.focus();
    };
  }, [open, ref, close]);
}
