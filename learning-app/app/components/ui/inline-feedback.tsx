import type { ReactNode } from "react";

type FeedbackVariant = "error" | "success" | "warning" | "info";

export function InlineFeedback({ children, variant = "info" }: { children: ReactNode; variant?: FeedbackVariant }) {
  const isError = variant === "error";

  return <div className={`inline-feedback inline-feedback-${variant}`} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>{children}</div>;
}
