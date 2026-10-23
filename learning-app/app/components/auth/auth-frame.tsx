"use client";

import { useLanguage } from "@/app/components/language-provider";
import Image from "next/image";
import { LearningMark } from "@/app/components/learning-mark";
import styles from "./auth-experience.module.css";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t, locale } = useLanguage();
  const skipLabel = locale === "fr" ? "Aller au formulaire de compte" : locale === "es" ? "Ir al formulario de la cuenta" : "Skip to account form";
  return (
    <main className={`auth-page ${styles.frame}`}>
      <a className={styles.skip} href="#account-form-area">{skipLabel}</a>
      <aside className="auth-story">
        <LearningMark href="/" />
        <div className="auth-story-copy">
          <p className="eyebrow">Growvelt</p>
          <h2>{t("auth.storyTitle")}</h2>
          <div className="auth-value-list">
            <p><span>01</span>{t("auth.storyOne")}</p>
            <p><span>02</span>{t("auth.storyTwo")}</p>
            <p><span>03</span>{t("auth.storyThree")}</p>
          </div>
        </div>
        <Image className="auth-side-card-image" src="/images/Auth-side-card.png" alt="" width={900} height={900} priority />
        <div className="auth-story-motif" aria-hidden="true"><i /><i /><i /></div>
        <p className="auth-story-note">{t("auth.storyNote")}</p>
      </aside>
      <section className="auth-form-area" id="account-form-area" tabIndex={-1}>{children}</section>
    </main>
  );
}
