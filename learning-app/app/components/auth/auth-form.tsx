"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { TurnstileWidget } from "@/app/components/auth/turnstile-widget";
import { LearningIcon } from "@/app/components/learning-icon";
import { getExplicitSafeNextPath, getSafeNextPath } from "@/app/lib/auth/redirect";
import { verifyTurnstileToken } from "@/app/lib/auth/turnstile";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";

type AuthMode = "sign-in" | "sign-up";
type OnboardingIntent = "learn" | "teach";
const friendlyAuthError = "We couldn’t complete that request. Check your details and try again.";

function GoogleMark() { return <span aria-hidden="true" className="google-glyph"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.7V7.4H2.9a10 10 0 0 0 0 8.9l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.9 7.4l3.3 2.6C7 7.8 9.3 6 12 6Z"/></svg></span>; }

export function AuthForm({ mode, next }: { mode: AuthMode; next?: string | null }) {
  const { t } = useLanguage();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [intent, setIntent] = useState<OnboardingIntent>("learn");
  const intentRef = useRef<OnboardingIntent>("learn");
  const pendingRef = useRef(false);
  const isSignUp = mode === "sign-up";
  const explicitSafeNext = getExplicitSafeNextPath(next);
  const safeNext = getSafeNextPath(next);
  const authModeHref = (path: "/sign-in" | "/sign-up") => `${path}?next=${encodeURIComponent(intent === "teach" ? "/teach/application" : safeNext)}`;

  function getPostAuthDestination() {
    return explicitSafeNext ?? (intentRef.current === "teach" ? "/teach/application" : safeNext);
  }

  function selectIntent(nextIntent: OnboardingIntent) {
    intentRef.current = nextIntent;
    setIntent(nextIntent);
  }

  async function begin(action: () => Promise<void>, turnstileAction: "sign_in" | "sign_up") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setMessage("");
    setIsBusy(true);
    try {
      const verification = await verifyTurnstileToken(turnstileToken, turnstileAction);
      if (!verification.ok) {
        setMessage(verification.message);
        setIsBusy(false);
        pendingRef.current = false;
        return;
      }
      await action();
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    } catch {
      setMessage("Authentication is not configured on this environment yet. Please try again later.");
      setIsBusy(false);
      pendingRef.current = false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const confirmation = String(form.get("password_confirmation") ?? "");

    if (isSignUp && password !== confirmation) {
      setMessage("Your passwords do not match.");
      return;
    }

    await begin(async () => {
      const supabase = createClient();
      if (isSignUp) {
        const postAuthDestination = getPostAuthDestination();
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, growvelt_learning_welcome_email_pending: true }, emailRedirectTo: new URL(`/auth/callback?next=${encodeURIComponent(postAuthDestination)}`, window.location.origin).href } });
        if (error) {
          setMessage(friendlyAuthError);
          setIsBusy(false);
          pendingRef.current = false;
          return;
        }
        window.location.assign(`/check-email?next=${encodeURIComponent(postAuthDestination)}`);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("Your email or password was not accepted. Please try again.");
        setIsBusy(false);
        pendingRef.current = false;
        return;
      }
      window.location.assign(safeNext);
    }, isSignUp ? "sign_up" : "sign_in");
  }

  async function continueWithGoogle() {
    const postAuthDestination = getPostAuthDestination();
    await begin(async () => {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", postAuthDestination);
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.href } });
      if (error) {
        setMessage("Google sign-in could not be started. Please try again.");
        setIsBusy(false);
        pendingRef.current = false;
      }
    }, isSignUp ? "sign_up" : "sign_in");
  }

  return <form className="auth-card" onSubmit={submit} noValidate>
    <Link className="auth-home-link" href="/"><LearningIcon name="arrow-left" size={18} />{t("auth.backHome")}</Link>
    <nav className="auth-mode-tabs" aria-label="Account access"><Link className={isSignUp ? "is-active" : ""} aria-current={isSignUp ? "page" : undefined} href={authModeHref("/sign-up")}>{t("auth.createAccount")}</Link><Link className={!isSignUp ? "is-active" : ""} aria-current={!isSignUp ? "page" : undefined} href={authModeHref("/sign-in")}>{t("auth.signIn")}</Link></nav>
    <div className="auth-card-heading"><p className="eyebrow">{isSignUp ? t("auth.startLearning") : t("auth.welcomeBack")}</p><h1>{isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}</h1><p>{isSignUp ? t("auth.signUpCopy") : t("auth.signInCopy")}</p></div>
    {isSignUp && <fieldset className="intent-picker"><legend>I want to:</legend><div className="intent-options"><button className={intent === "learn" ? "intent-option intent-learn is-selected" : "intent-option intent-learn"} type="button" onClick={() => selectIntent("learn")} aria-pressed={intent === "learn"} disabled={isBusy}><strong>{t("auth.learn")}</strong><span>{t("auth.learnCopy")}</span></button><button className={intent === "teach" ? "intent-option intent-teach is-selected" : "intent-option intent-teach"} type="button" onClick={() => selectIntent("teach")} aria-pressed={intent === "teach"} disabled={isBusy}><strong>{t("auth.teach")}</strong><span>{t("auth.teachCopy")}</span></button></div><small>{t("auth.teachNote")}</small></fieldset>}
    <ActionButton className="google-button" type="button" onClick={continueWithGoogle} isPending={isBusy} pendingLabel="Opening Google…"><GoogleMark /> {t("auth.google")}</ActionButton><div className="auth-divider" aria-hidden="true"><span>{t("auth.emailDivider")}</span></div>
    {isSignUp && <label className="field-label">{t("auth.displayName")}<input name="full_name" type="text" autoComplete="name" required maxLength={160} disabled={isBusy} /></label>}<label className="field-label">{t("auth.email")}<input name="email" type="email" autoComplete="email" required disabled={isBusy} /></label><label className="field-label">{t("auth.password")}<span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={8} disabled={isBusy} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} disabled={isBusy}>{showPassword ? "Hide" : "Show"}</button></span></label>{isSignUp && <label className="field-label">{t("auth.confirmPassword")}<input name="password_confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={isBusy} /></label>}<TurnstileWidget action={isSignUp ? "sign_up" : "sign_in"} onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
    {!isSignUp && <Link className="auth-inline-link" href="/forgot-password">{t("auth.forgot")}</Link>}{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<ActionButton className="button button-primary auth-submit" type="submit" isPending={isBusy} pendingLabel={isSignUp ? t("auth.createPending") : t("auth.signInPending")}>{isSignUp ? t("auth.create") : t("auth.signIn")}</ActionButton>
    {isSignUp ? <p className="auth-legal">By creating an account, you agree to the Growvelt <a href="/terms-of-service">Terms of Service</a> and acknowledge the Growvelt <a href="/privacy-policy">Privacy Policy</a>.</p> : <p className="auth-legal"><a href="/terms-of-service">Terms of Service</a><span aria-hidden="true"> · </span><a href="/privacy-policy">Privacy Policy</a></p>}
  </form>;
}
