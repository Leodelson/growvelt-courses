"use client";

import { useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { createClient } from "@/app/lib/supabase/browser";

export function SignOutButton() {
  const [isBusy, setIsBusy] = useState(false);
  const pendingRef = useRef(false);

  async function signOut() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // A local redirect still removes the user from protected UI. The proxy
      // will reject an unchanged or expired server session on the next request.
    }
    window.location.assign("/");
  }

  return <ActionButton className="profile-button profile-sign-out" type="button" onClick={signOut} isPending={isBusy} pendingLabel="Signing out…">Sign out</ActionButton>;
}
