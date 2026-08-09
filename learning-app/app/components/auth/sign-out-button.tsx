"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";

export function SignOutButton() {
  const [isBusy, setIsBusy] = useState(false);

  async function signOut() {
    setIsBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // A local redirect still removes the user from protected UI. The proxy
      // will reject an unchanged or expired server session on the next request.
    }
    window.location.assign("/");
  }

  return <button className="profile-button profile-sign-out" type="button" onClick={signOut} disabled={isBusy}>{isBusy ? "…" : "Sign out"}</button>;
}
