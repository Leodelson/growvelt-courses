"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isPending?: boolean;
  pendingLabel?: ReactNode;
};

export function ActionButton({ children, className, disabled, isPending = false, pendingLabel, ...props }: ActionButtonProps) {
  const label = isPending ? (pendingLabel ?? children) : children;

  return <button {...props} className={`action-button${className ? ` ${className}` : ""}`} disabled={disabled || isPending} aria-busy={isPending || undefined}>{isPending && <span className="action-spinner" aria-hidden="true" />}{label}</button>;
}
