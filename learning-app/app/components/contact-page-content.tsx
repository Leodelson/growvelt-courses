"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, LifeBuoy, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLanguage } from "@/app/components/language-provider";
import { PublicInquiryForm } from "@/app/components/public-inquiry-form";
import styles from "./public-support-pages.module.css";

const copy = {
  en: {
    eyebrow: "Contact us", title: "How can we help you?", intro: "Reach out about a course, learner support, teaching with Growvelt, a job or career question, or a partnership idea. Use the form or choose the support channel that works best for you.", support: "Growvelt support", location: "Abuja, Nigeria · Serving learners online", hours: "Monday-Friday, 9:00 AM-5:00 PM WAT", channels: [{ title: "Email support", description: "Questions about courses, learning, or your Growvelt account.", label: "support@growvelt.com" }, { title: "WhatsApp support", description: "Message the Growvelt team directly for practical support.", label: "Message on WhatsApp" }, { title: "Call Growvelt", description: "Available Monday to Friday, 9:00 AM-5:00 PM WAT.", label: "+234 903 487 6746" }],
  },
  fr: {
    eyebrow: "Nous contacter", title: "Comment pouvons-nous vous aider ?", intro: "Contactez-nous au sujet d’un cours, de l’assistance aux apprenants, de l’enseignement avec Growvelt, d’une question d’emploi ou de carrière, ou d’une idée de partenariat. Utilisez le formulaire ou le canal d’assistance qui vous convient.", support: "Assistance Growvelt", location: "Abuja, Nigeria · Au service des apprenants en ligne", hours: "Du lundi au vendredi, de 9 h à 17 h WAT", channels: [{ title: "Assistance e-mail", description: "Questions sur les cours, l’apprentissage ou votre compte Growvelt.", label: "support@growvelt.com" }, { title: "Assistance WhatsApp", description: "Envoyez un message direct à l’équipe Growvelt pour une aide pratique.", label: "Écrire sur WhatsApp" }, { title: "Appeler Growvelt", description: "Disponible du lundi au vendredi, de 9 h à 17 h WAT.", label: "+234 903 487 6746" }],
  },
  es: {
    eyebrow: "Contáctanos", title: "¿Cómo podemos ayudarte?", intro: "Escríbenos sobre un curso, soporte para estudiantes, enseñar con Growvelt, una pregunta de empleo o carrera, o una idea de colaboración. Usa el formulario o el canal de soporte que mejor te funcione.", support: "Soporte de Growvelt", location: "Abuya, Nigeria · Atendiendo a estudiantes en línea", hours: "De lunes a viernes, de 9:00 a 17:00 WAT", channels: [{ title: "Soporte por correo", description: "Preguntas sobre cursos, aprendizaje o tu cuenta de Growvelt.", label: "support@growvelt.com" }, { title: "Soporte por WhatsApp", description: "Envía un mensaje directo al equipo de Growvelt para obtener ayuda práctica.", label: "Enviar mensaje por WhatsApp" }, { title: "Llamar a Growvelt", description: "Disponible de lunes a viernes, de 9:00 a 17:00 WAT.", label: "+234 903 487 6746" }],
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

  const faqLabel = { en: "Explore the help centre", fr: "Explorer le centre d’aide", es: "Explorar el centro de ayuda" }[locale];

  return <main id="public-main" className={`${styles.page} ${styles.contact}`}>
    <div className={styles.heroBand}>
      <section className={styles.contactHero} aria-labelledby="contact-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><LifeBuoy size={17} aria-hidden="true" />{text.eyebrow}</p>
          <h1 id="contact-title">{text.title}</h1><p className={styles.lede}>{text.intro}</p>
          <Link className={styles.helpLink} href="/frequently-asked-questions">{faqLabel}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          <aside className={styles.supportDetails} aria-label={text.support}>
            <p><MapPin size={17} aria-hidden="true" /><span>{text.location}</span></p>
            <p><Clock3 size={17} aria-hidden="true" /><span>{text.hours}</span></p>
          </aside>
        </div>
        <div className={styles.contactPhoto}>
          <Image src="/images/contact-support-hero.webp" alt="" width={1200} height={800} sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1280px) 46vw, 550px" loading="eager" />
        </div>
      </section>
    </div>
    <section className={styles.channelGrid} aria-label={text.support}>
      {text.channels.map(({ title, description, label }, index) => {
        const { href, Icon } = channelDetails[index];
        const external = href.startsWith("http");
        return <article key={href}><span className={styles.channelIcon}><Icon size={23} aria-hidden="true" /></span><h2>{title}</h2><p>{description}</p><a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{label}<ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only">{external ? " in a new tab" : ""}</span></a></article>;
      })}
    </section>
    <div className={styles.formShell}><PublicInquiryForm kind="contact" /></div>
  </main>;
}
