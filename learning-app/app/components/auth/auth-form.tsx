"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import { getSafeNextPath } from "@/app/lib/auth/redirect";

type AuthMode = "sign-in" | "sign-up";

const friendlyAuthError = "We couldn’t complete that request. Check your details and try again.";

export function AuthForm({ mode, next }: { mode: AuthMode; next?: string | null }) {
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const safeNext = getSafeNextPath(next);
  const isSignUp = mode === "sign-up";

  async function withClient(action: () => Promise<void>) {
    setMessage("");
    setIsBusy(true);
    try {
      await action();
    } catch {
      setMessage("Authentication is not configured on this environment yet. Please try again later.");
      setIsBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const confirmation = String(form.get("password_confirmation") ?? "");

    if (isSignUp && password !== confirmation) {
      setMessage("Your passwords do not match.");
      return;
    }

    await withClient(async () => {
      const supabase = createClient();
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: new URL(`/auth/callback?next=${encodeURIComponent("/dashboard")}`, window.location.origin).href,
          },
        });
        if (error) {
          setMessage(friendlyAuthError);
          setIsBusy(false);
          return;
        }
        window.location.assign("/check-email");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("Your email or password was not accepted. Please try again.");
        setIsBusy(false);
        return;
      }
      window.location.assign(safeNext);
    });
  }

  async function continueWithGoogle() {
    await withClient(async () => {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeNext);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.href },
      });
      if (error) {
        setMessage("Google sign-in could not be started. Please try again.");
        setIsBusy(false);
      }
    });
  }

  return <form className="auth-card" onSubmit={submit} noValidate>
    <div className="auth-card-heading">
      <p className="eyebrow">{isSignUp ? "Start learning" : "Welcome back"}</p>
      <h1>{isSignUp ? "Build your next proof point." : "Continue your learning."}</h1>
      <p>{isSignUp ? "Create your Learner account. Teaching access is reviewed separately." : "Sign in to return to your Growvelt Learning space."}</p>
    </div>
    <button className="google-button" type="button" onClick={continueWithGoogle} disabled={isBusy}>
      <span aria-hidden="true" className="google-glyph">G</span> Continue with Google
    </button>
    <div className="auth-divider" aria-hidden="true"><span>or continue with email</span></div>
    {isSignUp && <label className="field-label">Display name<input name="full_name" type="text" autoComplete="name" required maxLength={160} disabled={isBusy} /></label>}
    <label className="field-label">Email address<input name="email" type="email" autoComplete="email" required disabled={isBusy} /></label>
    <label className="field-label">Password<span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={8} disabled={isBusy} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span></label>
    {isSignUp && <label className="field-label">Confirm password<input name="password_confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={isBusy} /></label>}
    {!isSignUp && <Link className="auth-inline-link" href="/forgot-password">Forgot password?</Link>}
    {message && <p className="auth-message" role="status">{message}</p>}
    <button className="button button-primary auth-submit" type="submit" disabled={isBusy}>{isBusy ? "Please wait…" : isSignUp ? "Create Learner account" : "Sign in"}</button>
    {isSignUp ? <p className="auth-legal">By creating an account, you agree to the <a href="https://www.courses.growvelt.com/terms-of-service.html" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="https://www.courses.growvelt.com/privacy-policy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</p> : <p className="auth-switch">New to Growvelt Learning? <Link href="/sign-up">Create an account</Link>.</p>}
    {isSignUp && <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link>.</p>}
  </form>;
}
