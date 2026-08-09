"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import { getSafeNextPath } from "@/app/lib/auth/redirect";

type AuthMode = "sign-in" | "sign-up";
type OnboardingIntent = "learn" | "teach";
const friendlyAuthError = "We couldn’t complete that request. Check your details and try again.";

function GoogleMark() { return <span aria-hidden="true" className="google-glyph"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.7V7.4H2.9a10 10 0 0 0 0 8.9l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.9 7.4l3.3 2.6C7 7.8 9.3 6 12 6Z"/></svg></span>; }

export function AuthForm({ mode, next }: { mode: AuthMode; next?: string | null }) {
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [intent, setIntent] = useState<OnboardingIntent>("learn");
  const isSignUp = mode === "sign-up";
  const safeNext = getSafeNextPath(next);
  const postAuthDestination = isSignUp && intent === "teach" ? "/teach" : safeNext;

  async function withClient(action: () => Promise<void>) { setMessage(""); setIsBusy(true); try { await action(); } catch { setMessage("Authentication is not configured on this environment yet. Please try again later."); setIsBusy(false); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? "").trim(); const password = String(form.get("password") ?? ""); const fullName = String(form.get("full_name") ?? "").trim(); const confirmation = String(form.get("password_confirmation") ?? "");
    if (isSignUp && password !== confirmation) { setMessage("Your passwords do not match."); return; }
    await withClient(async () => { const supabase = createClient(); if (isSignUp) { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: new URL(`/auth/callback?next=${encodeURIComponent(postAuthDestination)}`, window.location.origin).href } }); if (error) { setMessage(friendlyAuthError); setIsBusy(false); return; } window.location.assign("/check-email"); return; } const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) { setMessage("Your email or password was not accepted. Please try again."); setIsBusy(false); return; } window.location.assign(safeNext); });
  }
  async function continueWithGoogle() { await withClient(async () => { const callback = new URL("/auth/callback", window.location.origin); callback.searchParams.set("next", postAuthDestination); const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.href } }); if (error) { setMessage("Google sign-in could not be started. Please try again."); setIsBusy(false); } }); }

  return <form className="auth-card" onSubmit={submit} noValidate>
    <nav className="auth-mode-tabs" aria-label="Account access"><Link className={!isSignUp ? "is-active" : ""} href="/sign-in">Sign in</Link><Link className={isSignUp ? "is-active" : ""} href="/sign-up">Create account</Link></nav>
    <div className="auth-card-heading"><p className="eyebrow">{isSignUp ? "Start learning" : "Welcome back"}</p><h1>{isSignUp ? "Build your next proof point." : "Continue your learning."}</h1><p>{isSignUp ? "Create your Growvelt Learning account. Learn new skills or apply to teach on Growvelt." : "Sign in to return to your Growvelt Learning space."}</p></div>
    {isSignUp && <fieldset className="intent-picker"><legend>I want to:</legend><div className="intent-options"><button className={intent === "learn" ? "intent-option intent-learn is-selected" : "intent-option intent-learn"} type="button" onClick={() => setIntent("learn")} aria-pressed={intent === "learn"}><strong>Learn</strong><span>Build practical skills, complete courses and earn proof of learning.</span></button><button className={intent === "teach" ? "intent-option intent-teach is-selected" : "intent-option intent-teach"} type="button" onClick={() => setIntent("teach")} aria-pressed={intent === "teach"}><strong>Teach</strong><span>Share your expertise and create courses for Growvelt learners.</span></button></div><small>Teaching access requires a separate Instructor application and Growvelt approval.</small></fieldset>}
    <button className="google-button" type="button" onClick={continueWithGoogle} disabled={isBusy}><GoogleMark /> Continue with Google</button><div className="auth-divider" aria-hidden="true"><span>or continue with email</span></div>
    {isSignUp && <label className="field-label">Display name<input name="full_name" type="text" autoComplete="name" required maxLength={160} disabled={isBusy} /></label>}<label className="field-label">Email address<input name="email" type="email" autoComplete="email" required disabled={isBusy} /></label><label className="field-label">Password<span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={8} disabled={isBusy} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span></label>{isSignUp && <label className="field-label">Confirm password<input name="password_confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={isBusy} /></label>}
    {!isSignUp && <Link className="auth-inline-link" href="/forgot-password">Forgot password?</Link>}{message && <p className="auth-message" role="status">{message}</p>}<button className="button button-primary auth-submit" type="submit" disabled={isBusy}>{isBusy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}</button>
    {isSignUp ? <p className="auth-legal">By creating an account, you agree to the Growvelt <a href="https://www.courses.growvelt.com/terms-of-service.html" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the Growvelt <a href="https://www.courses.growvelt.com/privacy-policy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</p> : <p className="auth-legal"><a href="https://www.courses.growvelt.com/terms-of-service.html" target="_blank" rel="noreferrer">Terms of Service</a><span aria-hidden="true"> · </span><a href="https://www.courses.growvelt.com/privacy-policy.html" target="_blank" rel="noreferrer">Privacy Policy</a></p>}
  </form>;
}
