"use client";

import { useEffect, useRef } from "react";
import styles from "./action-feedback.module.css";

export function ActionFeedback({ message, kind }: { message: string | null; kind: "success" | "error" }) {
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const notice = noticeRef.current;
    if (!message || !notice) return;

    notice.focus({ preventScroll: true });
    notice.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  }, [message]);

  if (!message) return null;
  return <p ref={noticeRef} className={`${styles.notice} ${kind === "success" ? styles.success : styles.error}`} role={kind === "success" ? "status" : "alert"} tabIndex={-1}>{message}</p>;
}
