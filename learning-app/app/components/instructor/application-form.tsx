"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import type { InstructorApplicationIdentity } from "@/app/lib/instructor/application";
import { useLanguage } from "@/app/components/language-provider";
import { ApplicationRegionPicker } from "./application-region-picker";
import styles from "./application-region-picker.module.css";

const regionCopy = {
  en: { choose: "Select a country", search: "Search countries", dial: "Calling code", searchDial: "Search country or calling code", empty: "No matches found", invalidPhone: "Enter a valid phone number for the selected calling code." },
  fr: { choose: "Sélectionnez un pays", search: "Rechercher un pays", dial: "Indicatif", searchDial: "Rechercher un pays ou un indicatif", empty: "Aucun résultat", invalidPhone: "Saisissez un numéro valide pour l’indicatif sélectionné." },
  es: { choose: "Selecciona un país", search: "Buscar países", dial: "Prefijo", searchDial: "Buscar país o prefijo", empty: "No se encontraron resultados", invalidPhone: "Introduce un número válido para el prefijo seleccionado." },
};

const englishRegionNames = new Intl.DisplayNames("en", { type: "region" });

function RequiredLabel({ text }: { text: string }) {
  return <span className="field-label">{text} <span className="required-mark" aria-hidden="true">*</span></span>;
}

export function InstructorApplicationForm({ identity }: { identity: InstructorApplicationIdentity }) {
  const { t, locale } = useLanguage();
  const regionText = regionCopy[locale];
  const regions = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: "region" });
    return getCountries().map((code) => ({ code, name: names.of(code) ?? code, dialCode: `+${getCountryCallingCode(code)}` }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);
  const [countryCode, setCountryCode] = useState<CountryCode | "">("");
  const [phoneRegion, setPhoneRegion] = useState<CountryCode | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const values = new FormData(event.currentTarget);
    const country = countryCode ? englishRegionNames.of(countryCode) ?? countryCode : "";
    const yearsExperienceValue = String(values.get("years_experience") ?? "").trim();
    const yearsExperience = Number(yearsExperienceValue);
    const portfolioUrl = String(values.get("portfolio_url") ?? "").trim();

    if (!country || !yearsExperienceValue || !Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      setMessage(t("teach.validation"));
      return;
    }

    const phoneValue = String(values.get("phone") ?? "").trim();
    const phone = phoneValue ? parsePhoneNumberFromString(phoneValue, { defaultCountry: phoneRegion || countryCode || undefined, extract: false }) : undefined;
    if (phoneValue && !phone?.isPossible()) {
      setMessage(regionText.invalidPhone);
      return;
    }

    if (portfolioUrl) {
      try {
        const url = new URL(portfolioUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL protocol");
      } catch {
        setMessage(t("teach.linkValidation"));
        return;
      }
    }

    const expertise = String(values.get("expertise") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
    pendingRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/instructor/application", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, phone: phone?.number ?? "", headline: String(values.get("headline") ?? "").trim(), expertise, yearsExperience, teachingExperience: String(values.get("teaching_experience") ?? "").trim(), bio: String(values.get("bio") ?? "").trim(), motivation: String(values.get("motivation") ?? "").trim(), portfolioUrl }) });
      if (!response.ok) throw new Error("application_unavailable");
      window.location.assign("/teach/application");
    } catch {
      setMessage(t("teach.submitFailed"));
      setBusy(false);
      pendingRef.current = false;
    }
  }

  return <form className="instructor-application-form" onSubmit={submit}>
    <div className="application-account-summary" aria-label={t("teach.account")}>
      <p className="eyebrow">{t("teach.account")}</p>
      <strong>{identity.fullName || t("teach.applicant")}</strong>
      <span>{identity.email || t("teach.accountEmail")}</span>
      <small>{t("teach.accountNote")}</small>
    </div>
    <div className={styles.fields}>
      <div className={styles.field}>
        <RequiredLabel text={t("teach.country")} />
        <ApplicationRegionPicker regions={regions} selected={countryCode} onSelect={setCountryCode} label={t("teach.country")}
          placeholder={regionText.choose} searchLabel={regionText.search} emptyLabel={regionText.empty} disabled={busy} />
      </div>
      <div className={styles.field}>
        <label htmlFor="instructor-application-phone"><span className="field-label">{t("teach.phone")} <span className="field-label-optional">({t("teach.optional")})</span></span></label>
        <div className={styles.phone}>
          <ApplicationRegionPicker regions={regions} selected={phoneRegion || countryCode} onSelect={setPhoneRegion} label={regionText.dial}
            placeholder={regionText.dial} searchLabel={regionText.searchDial} emptyLabel={regionText.empty} disabled={busy} dial />
          <input id="instructor-application-phone" name="phone" type="tel" maxLength={32} autoComplete="tel-national" disabled={busy} />
        </div>
      </div>
    </div>
    <label><RequiredLabel text={t("teach.headline")} /><input name="headline" required maxLength={160} placeholder="e.g. Data analyst and practical SQL educator" disabled={busy} /></label>
    <label><RequiredLabel text={t("teach.expertise")} /><input name="expertise" required placeholder="e.g. SQL, data analysis, Power BI" disabled={busy} /><small>{t("teach.expertiseNote")}</small></label>
    <label><RequiredLabel text={t("teach.years")} /><input name="years_experience" required type="number" min="0" max="60" step="1" inputMode="numeric" placeholder="e.g. 6" disabled={busy} /></label>
    <label><RequiredLabel text={t("teach.experience")} /><textarea name="teaching_experience" required maxLength={1500} rows={4} placeholder="Describe any teaching, mentoring, workshop, or training experience you have." disabled={busy} /></label>
    <label><RequiredLabel text={t("teach.bio")} /><textarea name="bio" required maxLength={2000} rows={6} placeholder="Share the practical experience you bring and the learners you are well placed to help." disabled={busy} /></label>
    <label><RequiredLabel text={t("teach.motivation")} /><textarea name="motivation" required maxLength={1500} rows={5} placeholder="Tell us what you want learners to gain from the courses you would create." disabled={busy} /></label>
    <label>{t("teach.portfolio")} <span>({t("teach.optional")})</span><input name="portfolio_url" type="url" maxLength={500} inputMode="url" placeholder="https://" disabled={busy} /><small>{t("teach.portfolioNote")}</small></label>
    <p className="instructor-form-note">{t("teach.formNote")}</p>
    {message && <InlineFeedback variant="error">{message}</InlineFeedback>}
    <ActionButton className="button button-primary" type="submit" isPending={busy} pendingLabel={t("teach.submitting")}>{t("teach.submit")}</ActionButton>
  </form>;
}
