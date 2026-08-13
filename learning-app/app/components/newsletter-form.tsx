"use client";

import { FormEvent, useState } from "react";
import { subscribeToNewsletter } from "@/app/lib/newsletter";

export function NewsletterForm() {
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
      <label className="sr-only" htmlFor="footer-newsletter-email">Email address</label>
      <div className="growvelt-footer-subscribe-row">
        <input id="footer-newsletter-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" autoComplete="email" disabled={pending} required />
        <button type="submit" disabled={pending}>{pending ? "Subscribing…" : "Subscribe"}</button>
      </div>
      {message ? <p className={`growvelt-newsletter-message is-${status}`} role={status === "error" ? "alert" : "status"}>{message}</p> : null}
    </form>
  );
}
