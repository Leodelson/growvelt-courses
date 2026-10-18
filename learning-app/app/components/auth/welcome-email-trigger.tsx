"use client";

import { useEffect } from "react";
import { learningPath } from "@/app/lib/site-urls.mjs";

export function WelcomeEmailTrigger() {
  useEffect(() => {
    void fetch(learningPath("/api/auth/welcome"), { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }, []);

  return null;
}
