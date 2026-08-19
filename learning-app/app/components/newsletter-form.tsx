"use client";

import { FormEvent, useState } from "react";
import { subscribeToNewsletter } from "@/app/lib/newsletter";
import { useLanguage } from "@/app/components/language-provider";

export function NewsletterForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    setStatus(null);
    const result = await subscribeToNewsletter(email);
    setPending(false);
    setStatus(result.type);
    setMessage(result.message);
    if (result.type === "success") setEmail("");
  }

  return (
    <form onSubmit={submit} aria-describedby="newsletter-note" noValidate>
      <label className="sr-only" htmlFor="footer-newsletter-email">{t("footer.emailAddress")}</label>
      <div className="growvelt-footer-subscribe-row">
        <input id="footer-newsletter-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("footer.emailPlaceholder")} autoComplete="email" disabled={pending} required />
        <button type="submit" disabled={pending}>{pending ? t("footer.subscribing") : t("footer.subscribe")}</button>
      </div>
      {message ? <p className={`growvelt-newsletter-message is-${status}`} role={status === "error" ? "alert" : "status"}>{message}</p> : null}
    </form>
  );
}
