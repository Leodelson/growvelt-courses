"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { useLanguage } from "@/app/components/language-provider";

export function ProfileSettingsForm({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextName = String(new FormData(event.currentTarget).get("full_name") ?? "").trim();
    if (!nextName) {
      setErrorMessage(t("profile.nameHint"));
      return;
    }

    setBusy(true);
    setErrorMessage("");
    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: nextName })
      .eq("id", userId);

    if (error) {
      setErrorMessage(t("profile.saveFailed"));
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
          {t("profile.edit")}
        </button>
      </>
    );
  }

  return (
    <form className="profile-inline-editor" onSubmit={save}>
      <label htmlFor="profile-display-name">{t("profile.displayName")}</label>
      <input id="profile-display-name" name="full_name" defaultValue={fullName} maxLength={160} autoFocus disabled={busy} />
      <small>{email}</small>
      {errorMessage && <InlineFeedback variant="error">{errorMessage}</InlineFeedback>}
      <div>
        <button className="button button-secondary" type="button" onClick={() => { setEditing(false); setErrorMessage(""); }} disabled={busy}>{t("profile.cancel")}</button>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? t("profile.saving") : t("profile.saveName")}</button>
      </div>
    </form>
  );
}
