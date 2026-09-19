"use client";

import { useEffect, useState } from "react";
import { ApplicationStatus } from "@/app/components/instructor/application-status";
import type { InstructorApplication } from "@/app/lib/instructor/application";

export function ApplicationStatusLoader() {
  const [application, setApplication] = useState<InstructorApplication | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/instructor/application", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ application: InstructorApplication | null }> : Promise.reject(new Error("status_unavailable")))
      .then((result) => { if (active) { setApplication(result.application); setState("ready"); } })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  if (state === "loading") return <section className="application-status"><p className="eyebrow">Instructor application</p><h1>Checking your application status…</h1><p>We’re loading the latest review status for this account.</p></section>;
  if (state === "unavailable") return <section className="application-status"><p className="eyebrow">Instructor application</p><h1>Your application is safe.</h1><p>We could not load its current review status right now. Please refresh this page shortly; do not submit another application.</p></section>;
  return <ApplicationStatus application={application} />;
}
