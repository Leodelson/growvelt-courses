"use client";

import { useEffect } from "react";

export function WelcomeEmailTrigger() {
  useEffect(() => {
    void fetch("/api/auth/welcome", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }, []);

  return null;
}
