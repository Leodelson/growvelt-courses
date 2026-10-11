"use client";

import { useFormStatus } from "react-dom";
import styles from "./action-submit-button.module.css";

export function ActionSubmitButton({
  label,
  pendingLabel,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();

  return <button className={`button button-${tone} ${styles.button}`} type="submit" disabled={pending}>
    {pending ? <><span className={styles.spinner} aria-hidden="true" /><span role="status">{pendingLabel}</span></> : label}
  </button>;
}
