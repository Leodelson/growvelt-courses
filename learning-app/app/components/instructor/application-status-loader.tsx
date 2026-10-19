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

  if (state === "loading") return <section className="application-status" aria-busy="true"><p className="eyebrow">Instructor application</p><h1>Checking your application status…</h1><p role="status">We’re loading the latest review status for this account.</p></section>;
  if (state === "unavailable") return <section className="application-status" role="alert"><p className="eyebrow">Instructor application</p><h1>Application status unavailable</h1><p>We could not load the current review status. Try loading this page again before submitting another application.</p><button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Try again</button></section>;
  return <ApplicationStatus application={application} />;
}
