"use client";

import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { PublicInquiryForm } from "@/app/components/public-inquiry-form";

const copy = {
  en: {
    eyebrow: "Contact us", title: "Let’s make your next learning step clearer.", intro: "Reach out about a course, learner support, teaching with Growvelt, a job or career question, or a partnership idea. Use the form or choose the support channel that works best for you.", support: "Growvelt Learning support", location: "Abuja, Nigeria · Serving learners online", hours: "Monday-Friday, 9:00 AM-5:00 PM WAT", channels: [{ title: "Email support", description: "Questions about courses, learning, or your Growvelt account.", label: "support@growvelt.com" }, { title: "WhatsApp support", description: "Message the Growvelt team directly for practical support.", label: "Message on WhatsApp" }, { title: "Call Growvelt", description: "Available Monday to Friday, 9:00 AM-5:00 PM WAT.", label: "+234 903 487 6746" }],
  },
  fr: {
    eyebrow: "Nous contacter", title: "Clarifions votre prochaine étape d’apprentissage.", intro: "Contactez-nous au sujet d’un cours, de l’assistance aux apprenants, de l’enseignement avec Growvelt, d’une question d’emploi ou de carrière, ou d’une idée de partenariat. Utilisez le formulaire ou le canal d’assistance qui vous convient.", support: "Assistance Growvelt Learning", location: "Abuja, Nigeria · Au service des apprenants en ligne", hours: "Du lundi au vendredi, de 9 h à 17 h WAT", channels: [{ title: "Assistance e-mail", description: "Questions sur les cours, l’apprentissage ou votre compte Growvelt.", label: "support@growvelt.com" }, { title: "Assistance WhatsApp", description: "Envoyez un message direct à l’équipe Growvelt pour une aide pratique.", label: "Écrire sur WhatsApp" }, { title: "Appeler Growvelt", description: "Disponible du lundi au vendredi, de 9 h à 17 h WAT.", label: "+234 903 487 6746" }],
  },
  es: {
    eyebrow: "Contáctanos", title: "Hagamos más claro tu próximo paso de aprendizaje.", intro: "Escríbenos sobre un curso, soporte para estudiantes, enseñar con Growvelt, una pregunta de empleo o carrera, o una idea de colaboración. Usa el formulario o el canal de soporte que mejor te funcione.", support: "Soporte de Growvelt Learning", location: "Abuya, Nigeria · Atendiendo a estudiantes en línea", hours: "De lunes a viernes, de 9:00 a 17:00 WAT", channels: [{ title: "Soporte por correo", description: "Preguntas sobre cursos, aprendizaje o tu cuenta de Growvelt.", label: "support@growvelt.com" }, { title: "Soporte por WhatsApp", description: "Envía un mensaje directo al equipo de Growvelt para obtener ayuda práctica.", label: "Enviar mensaje por WhatsApp" }, { title: "Llamar a Growvelt", description: "Disponible de lunes a viernes, de 9:00 a 17:00 WAT.", label: "+234 903 487 6746" }],
  },
} as const;

const channelDetails = [
  { href: "mailto:support@growvelt.com", Icon: Mail },
  { href: "https://wa.me/2349034876746", Icon: MessageCircle },
  { href: "tel:+2349034876746", Icon: Phone },
] as const;

export function ContactPageContent() {
  const { locale } = useLanguage();
  const text = copy[locale];

  return <main>
    <section className="contact-hero section-shell" aria-labelledby="contact-title">
      <div><p className="eyebrow">{text.eyebrow}</p><h1 id="contact-title">{text.title}</h1><p>{text.intro}</p></div>
      <aside><MapPin aria-hidden="true" /><strong>{text.support}</strong><span>{text.location}</span><small><Clock3 aria-hidden="true" /> {text.hours}</small></aside>
    </section>
    <section className="section-shell contact-channel-grid" aria-label={text.eyebrow}>
      {text.channels.map(({ title, description, label }, index) => {
        const { href, Icon } = channelDetails[index];
        const external = href.startsWith("http");
        return <article key={href}><Icon aria-hidden="true" /><h2>{title}</h2><p>{description}</p><a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{label}<span className="sr-only">{external ? " in a new tab" : ""}</span></a></article>;
      })}
    </section>
    <div className="section-shell"><PublicInquiryForm kind="contact" /></div>
  </main>;
}
