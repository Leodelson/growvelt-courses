"use client";

import { FormEvent, useState } from "react";

type InquiryKind = "contact" | "partnership";

type InquiryStatus = {
  type: "success" | "error";
  message: string;
};

type PublicInquiryFormProps = {
  kind: InquiryKind;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formCopy = {
  contact: {
    title: "Send a message",
    intro: "Tell us what you need and the Growvelt team will review your message.",
    submit: "Send message",
    pending: "Sending message…",
    subjectLabel: "What can we help with?",
    subjectOptions: ["Course question", "Learner support", "Teaching with Growvelt", "Jobs or Growvelt Careers", "Career tools or job application", "Business or partnership", "Other"],
  },
  partnership: {
    title: "Start a partnership conversation",
    intro: "Share the opportunity, the people you want to support, and the kind of collaboration you have in mind.",
    submit: "Send partnership request",
    pending: "Sending request…",
    subjectLabel: "Partnership type",
    subjectOptions: ["Corporate training", "Academic institution", "Nonprofit or NGO", "Community initiative", "Jobs or employer partnership", "Career-development partnership", "Referral or affiliate", "Other"],
  },
} as const;

export function PublicInquiryForm({ kind }: PublicInquiryFormProps) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<InquiryStatus | null>(null);
  const copy = formCopy[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim().toLowerCase();
    const subject = String(values.get("subject") ?? "").trim();
    const message = String(values.get("message") ?? "").trim();

    if (name.length < 2 || name.length > 160 || !emailPattern.test(email) || subject.length < 2 || message.length < 20) {
      setStatus({ type: "error", message: "Please complete your name, email, topic, and a message of at least 20 characters." });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          email,
          subject,
          message,
          organization: String(values.get("organization") ?? "").trim(),
          phone: String(values.get("phone") ?? "").trim(),
          website: String(values.get("website") ?? "").trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setStatus({ type: "error", message: data?.message ?? "We couldn’t send your message. Please try again." });
        return;
      }

      form.reset();
      setStatus({ type: "success", message: data?.message ?? "Thank you. Your message has been sent to Growvelt." });
    } catch {
      setStatus({ type: "error", message: "We couldn’t reach Growvelt right now. Please try again or use one of the direct support channels." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="public-inquiry-form" aria-labelledby={`${kind}-form-title`}>
      <div>
        <p className="eyebrow">{kind === "contact" ? "Message Growvelt" : "Partner with Growvelt"}</p>
        <h2 id={`${kind}-form-title`}>{copy.title}</h2>
        <p>{copy.intro}</p>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="public-inquiry-grid">
          <label>
            Full name
            <input name="name" type="text" autoComplete="name" maxLength={160} disabled={pending} required />
          </label>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} required />
          </label>
          <label>
            {kind === "partnership" ? "Organization" : "Organization (optional)"}
            <input name="organization" type="text" autoComplete="organization" maxLength={160} disabled={pending} required={kind === "partnership"} />
          </label>
          <label>
            Phone (optional)
            <input name="phone" type="tel" autoComplete="tel" maxLength={32} disabled={pending} />
          </label>
        </div>
        <label>
          {copy.subjectLabel}
          <select name="subject" defaultValue="" disabled={pending} required>
            <option value="" disabled>Select an option</option>
            {copy.subjectOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          {kind === "partnership" ? "Tell us about the partnership" : "Your message"}
          <textarea name="message" rows={7} maxLength={5000} disabled={pending} required />
        </label>
        <label className="public-inquiry-honeypot" aria-hidden="true">
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
        <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? copy.pending : copy.submit}</button>
        {status ? <p className={`public-inquiry-feedback is-${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p> : null}
      </form>
    </section>
  );
}
