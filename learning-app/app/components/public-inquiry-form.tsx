"use client";

import { FormEvent, useState } from "react";
import { useLanguage } from "@/app/components/language-provider";

type InquiryKind = "contact" | "partnership";

type InquiryStatus = {
  type: "success" | "error";
  message: string;
};

type PublicInquiryFormProps = {
  kind: InquiryKind;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formTranslations = {
  en: { contactKicker: "Message Growvelt", partnerKicker: "Partner with Growvelt", name: "Full name", email: "Email address", organization: "Organization", optional: "optional", phone: "Phone", select: "Select an option", contactMessage: "Your message", partnerMessage: "Tell us about the partnership", website: "Website", invalid: "Please complete your name, email, topic, and a message of at least 20 characters.", failed: "We couldn’t send your message. Please try again.", sent: "Thank you. Your message has been sent to Growvelt.", unavailable: "We couldn’t reach Growvelt right now. Please try again or use one of the direct support channels.", contact: { title: "Send a message", intro: "Tell us what you need and the Growvelt team will review your message.", submit: "Send message", pending: "Sending message…", subjectLabel: "What can we help with?", subjectOptions: ["Course question", "Learner support", "Teaching with Growvelt", "Jobs or Growvelt Careers", "Career tools or job application", "Business or partnership", "Other"] }, partnership: { title: "Start a partnership conversation", intro: "Share the opportunity, the people you want to support, and the kind of collaboration you have in mind.", submit: "Send partnership request", pending: "Sending request…", subjectLabel: "Partnership type", subjectOptions: ["Corporate training", "Academic institution", "Nonprofit or NGO", "Community initiative", "Jobs or employer partnership", "Career-development partnership", "Referral or affiliate", "Other"] } },
  fr: { contactKicker: "Écrire à Growvelt", partnerKicker: "Devenir partenaire de Growvelt", name: "Nom complet", email: "Adresse e-mail", organization: "Organisation", optional: "facultatif", phone: "Téléphone", select: "Sélectionnez une option", contactMessage: "Votre message", partnerMessage: "Parlez-nous du partenariat", website: "Site web", invalid: "Indiquez votre nom, votre e-mail, un sujet et un message d’au moins 20 caractères.", failed: "Nous n’avons pas pu envoyer votre message. Réessayez.", sent: "Merci. Votre message a été envoyé à Growvelt.", unavailable: "Nous ne pouvons pas joindre Growvelt pour le moment. Réessayez ou utilisez l’un des canaux d’assistance directs.", contact: { title: "Envoyer un message", intro: "Dites-nous ce dont vous avez besoin et l’équipe Growvelt examinera votre message.", submit: "Envoyer le message", pending: "Envoi du message…", subjectLabel: "Comment pouvons-nous vous aider ?", subjectOptions: ["Question sur un cours", "Assistance aux apprenants", "Enseigner avec Growvelt", "Emplois ou Growvelt Careers", "Outils de carrière ou candidature", "Entreprise ou partenariat", "Autre"] }, partnership: { title: "Démarrer une conversation de partenariat", intro: "Partagez l’opportunité, les personnes que vous souhaitez accompagner et le type de collaboration envisagé.", submit: "Envoyer la demande", pending: "Envoi de la demande…", subjectLabel: "Type de partenariat", subjectOptions: ["Formation en entreprise", "Établissement universitaire", "Association ou ONG", "Initiative communautaire", "Partenariat emploi ou employeur", "Partenariat de développement de carrière", "Recommandation ou affiliation", "Autre"] } },
  es: { contactKicker: "Enviar un mensaje a Growvelt", partnerKicker: "Asociarte con Growvelt", name: "Nombre completo", email: "Correo electrónico", organization: "Organización", optional: "opcional", phone: "Teléfono", select: "Selecciona una opción", contactMessage: "Tu mensaje", partnerMessage: "Cuéntanos sobre la colaboración", website: "Sitio web", invalid: "Completa tu nombre, correo electrónico, tema y un mensaje de al menos 20 caracteres.", failed: "No pudimos enviar tu mensaje. Inténtalo de nuevo.", sent: "Gracias. Tu mensaje se envió a Growvelt.", unavailable: "No pudimos contactar a Growvelt ahora. Inténtalo de nuevo o usa uno de los canales de soporte directo.", contact: { title: "Enviar un mensaje", intro: "Cuéntanos qué necesitas y el equipo de Growvelt revisará tu mensaje.", submit: "Enviar mensaje", pending: "Enviando mensaje…", subjectLabel: "¿Cómo podemos ayudarte?", subjectOptions: ["Pregunta sobre un curso", "Soporte para estudiantes", "Enseñar con Growvelt", "Empleos o Growvelt Careers", "Herramientas de carrera o solicitud", "Empresa o colaboración", "Otro"] }, partnership: { title: "Inicia una conversación de colaboración", intro: "Comparte la oportunidad, las personas a las que quieres apoyar y el tipo de colaboración que tienes en mente.", submit: "Enviar solicitud", pending: "Enviando solicitud…", subjectLabel: "Tipo de colaboración", subjectOptions: ["Capacitación corporativa", "Institución académica", "Organización sin fines de lucro u ONG", "Iniciativa comunitaria", "Colaboración de empleos o empleador", "Colaboración de desarrollo profesional", "Referidos o afiliados", "Otro"] } },
} as const;

export function PublicInquiryForm({ kind }: PublicInquiryFormProps) {
  const { locale } = useLanguage();
  const text = formTranslations[locale];
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<InquiryStatus | null>(null);
  const copy = text[kind];

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
      setStatus({ type: "error", message: text.invalid });
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
        setStatus({ type: "error", message: data?.message ?? text.failed });
        return;
      }

      form.reset();
      setStatus({ type: "success", message: data?.message ?? text.sent });
    } catch {
      setStatus({ type: "error", message: text.unavailable });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="public-inquiry-form" aria-labelledby={`${kind}-form-title`}>
      <div>
        <p className="eyebrow">{kind === "contact" ? text.contactKicker : text.partnerKicker}</p>
        <h2 id={`${kind}-form-title`}>{copy.title}</h2>
        <p>{copy.intro}</p>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="public-inquiry-grid">
          <label>
            {text.name}
            <input name="name" type="text" autoComplete="name" maxLength={160} disabled={pending} required />
          </label>
          <label>
            {text.email}
            <input name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} required />
          </label>
          <label>
            {kind === "partnership" ? text.organization : `${text.organization} (${text.optional})`}
            <input name="organization" type="text" autoComplete="organization" maxLength={160} disabled={pending} required={kind === "partnership"} />
          </label>
          <label>
            {text.phone} ({text.optional})
            <input name="phone" type="tel" autoComplete="tel" maxLength={32} disabled={pending} />
          </label>
        </div>
        <label>
          {copy.subjectLabel}
          <select name="subject" defaultValue="" disabled={pending} required>
            <option value="" disabled>{text.select}</option>
            {copy.subjectOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          {kind === "partnership" ? text.partnerMessage : text.contactMessage}
          <textarea name="message" rows={7} maxLength={5000} disabled={pending} required />
        </label>
        <label className="public-inquiry-honeypot" aria-hidden="true">
          {text.website}
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
        <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? copy.pending : copy.submit}</button>
        {status ? <p className={`public-inquiry-feedback is-${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p> : null}
      </form>
    </section>
  );
}
