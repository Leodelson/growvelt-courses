"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";

export function ProfileSettingsForm({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextName = String(new FormData(event.currentTarget).get("full_name") ?? "").trim();
    if (!nextName) {
      setErrorMessage("Enter the name you want shown in Growvelt Learning.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: nextName })
      .eq("id", userId);

    if (error) {
      setErrorMessage("We couldn’t save your profile. Please try again.");
      setBusy(false);
      return;
    }

    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <>
        <h2 id="profile-name">{fullName}</h2>
        <button className="button button-secondary profile-edit-link" type="button" onClick={() => setEditing(true)}>
          Edit profile
        </button>
      </>
    );
  }

  return (
    <form className="profile-inline-editor" onSubmit={save}>
      <label htmlFor="profile-display-name">Display name</label>
      <input id="profile-display-name" name="full_name" defaultValue={fullName} maxLength={160} autoFocus disabled={busy} />
      <small>{email}</small>
      {errorMessage && <InlineFeedback variant="error">{errorMessage}</InlineFeedback>}
      <div>
        <button className="button button-secondary" type="button" onClick={() => { setEditing(false); setErrorMessage(""); }} disabled={busy}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
      </div>
    </form>
  );
}
