"use client";

import { useLanguage } from "@/app/components/language-provider";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <div className="auth-story-copy">
          <p className="eyebrow">Growvelt Learning</p>
          <h1>{t("auth.storyTitle")}</h1>
          <div className="auth-value-list">
            <p><span>01</span>{t("auth.storyOne")}</p>
            <p><span>02</span>{t("auth.storyTwo")}</p>
            <p><span>03</span>{t("auth.storyThree")}</p>
          </div>
        </div>
        <div className="auth-story-motif" aria-hidden="true"><i /><i /><i /></div>
        <p className="auth-story-note">{t("auth.storyNote")}</p>
      </aside>
      <section className="auth-form-area">{children}</section>
    </main>
  );
}
