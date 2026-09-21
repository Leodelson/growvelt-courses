"use client";

import { useLanguage } from "@/app/components/language-provider";
import Image from "next/image";
import { LearningMark } from "@/app/components/learning-mark";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <LearningMark href="/" />
        <div className="auth-story-copy">
          <p className="eyebrow">Growvelt Learning</p>
          <h1>{t("auth.storyTitle")}</h1>
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
      <section className="auth-form-area">{children}</section>
    </main>
  );
}
