"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { useLanguage } from "@/app/components/language-provider";

type SocialLinks = {
  linkedinUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
};

const fields = [
  { name: "linkedin_url", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/your-name", hosts: ["linkedin.com"] },
  { name: "website_url", label: "Website or portfolio", placeholder: "https://yourwebsite.com", hosts: undefined },
  { name: "instagram_url", label: "Instagram", placeholder: "https://www.instagram.com/your-name", hosts: ["instagram.com"] },
  { name: "facebook_url", label: "Facebook", placeholder: "https://www.facebook.com/your-name", hosts: ["facebook.com"] },
  { name: "x_url", label: "X (Twitter)", placeholder: "https://x.com/your-name", hosts: ["x.com", "twitter.com"] },
] as const;

function normalizedUrl(value: string, allowedHosts?: readonly string[]) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    const matchesHost = !allowedHosts || allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    if (url.protocol !== "https:" || !matchesHost) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function ProfileSocialLinksForm({ userId, links }: { userId: string; links: SocialLinks }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const update: Record<string, string | null> = {};
    for (const field of fields) {
      const value = normalizedUrl(String(form.get(field.name) ?? ""), field.hosts);
      if (value === undefined) {
        setMessage(`${field.label} ${t("profile.linkInvalid")} ${field.hosts ? t("profile.linkProfile") : t("profile.linkWebsite")}`);
        return;
      }
      update[field.name] = value;
    }

    setBusy(true);
    setMessage("");
    const { error } = await createClient().from("profiles").update(update).eq("id", userId);
    setBusy(false);
    if (error) {
      const schemaCacheError = error.code === "PGRST204" || error.code === "42703";
      const permissionError = error.code === "42501";
      setMessage(schemaCacheError
        ? "The new profile-link fields are not available to Supabase yet. Run the migration again, including its final schema-cache reload line, then try again."
        : permissionError
          ? "Your account is not yet allowed to update profile links. Run the profile-links migration again, then try again."
          : `${t("profile.socialSaveFailed")} (${error.code ?? "unknown error"})`);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const available = fields.flatMap((field) => {
    const property = field.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof SocialLinks;
    const href = links[property];
    return href ? [{ label: field.label, href }] : [];
  });

  return <section className="profile-social-card" aria-labelledby="profile-social-links-title">
    <div className="profile-social-heading"><div><p className="eyebrow">{t("profile.socialEyebrow")}</p><h2 id="profile-social-links-title">{t("profile.socialTitle")}</h2><p>{t("profile.socialCopy")}</p></div><button className="button button-secondary" type="button" onClick={() => { setEditing((value) => !value); setMessage(""); }} disabled={busy}>{editing ? t("profile.cancel") : t("profile.editLinks")}</button></div>
    {editing ? <form className="profile-social-editor" onSubmit={save}>
      {fields.map((field) => {
        const property = field.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) as keyof SocialLinks;
        return <label key={field.name} htmlFor={`profile-${field.name}`}>{field.name === "website_url" ? t("profile.website") : field.label}<input id={`profile-${field.name}`} name={field.name} type="url" inputMode="url" autoComplete="url" defaultValue={links[property] ?? ""} placeholder={field.placeholder} maxLength={500} disabled={busy} /></label>;
      })}
      {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
      <div><button className="button button-primary" type="submit" disabled={busy}>{busy ? t("profile.saving") : t("profile.saveLinks")}</button></div>
    </form> : <div className="profile-social-list">{available.length ? available.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label}<span aria-hidden="true">↗</span><span className="sr-only"> opens in a new tab</span></a>) : <p>{t("profile.noLinks")}</p>}</div>}
  </section>;
}
