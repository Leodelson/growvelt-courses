"use client";

import { useState } from "react";

export function CommercialReleaseControl() {
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [releasedCount, setReleasedCount] = useState<number | null>(null);
  async function release() {
    setState("running"); setReleasedCount(null);
    try {
      const response = await fetch("/api/admin/commercial/release-matured", { method: "POST", credentials: "same-origin" });
      const data = await response.json() as { releasedCount?: unknown };
      if (!response.ok || typeof data.releasedCount !== "number") throw new Error("Release unavailable");
      setReleasedCount(data.releasedCount); setState("done");
    } catch { setState("failed"); }
  }
  return <section className="commercial-release-control" aria-live="polite">
    <div><p className="eyebrow">Matured earnings release</p><h2>Run a safe operational recovery.</h2><p>Releases only database-eligible earnings in a bounded batch. This does not create a payout or transfer.</p></div>
    <div><button className="button button-primary" type="button" onClick={release} disabled={state === "running"}>{state === "running" ? "Releasing…" : "Release matured earnings"}</button>
      {state === "done" && <p className="commercial-release-result">Completed: {releasedCount} earning{releasedCount === 1 ? "" : "s"} released.</p>}
      {state === "failed" && <p className="commercial-release-result is-error">The release could not be completed safely. Review the operational audit and try again later.</p>}
    </div>
  </section>;
}
