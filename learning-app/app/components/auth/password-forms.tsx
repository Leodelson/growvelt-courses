"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { TurnstileWidget } from "@/app/components/auth/turnstile-widget";
import { verifyTurnstileToken } from "@/app/lib/auth/turnstile";
import { createClient } from "@/app/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [isBusy, setIsBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const pendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsBusy(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();

    const verification = await verifyTurnstileToken(turnstileToken, "password_recovery");
    if (!verification.ok) {
      setMessage(verification.message);
      setIsBusy(false);
      pendingRef.current = false;
      return;
    }

    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("/auth/callback?next=/reset-password", window.location.origin).href });
    } catch {
      // Keep the outcome neutral to avoid account enumeration.
    }

    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    setSent(true);
    setIsBusy(false);
    pendingRef.current = false;
  }

  return <form className="auth-card" onSubmit={submit}>
    <div className="auth-card-heading"><p className="eyebrow">Account recovery</p><h1>Reset your password.</h1><p>Enter your email and we’ll send recovery instructions if an account can use them.</p></div>
    {sent ? <InlineFeedback variant="success"><strong>Check your email.</strong><p>If the address can receive a reset, recovery instructions are on their way. Check spam or junk folders too.</p></InlineFeedback> : <><label className="field-label">Email address<input name="email" type="email" autoComplete="email" required disabled={isBusy} /></label><TurnstileWidget action="password_recovery" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<ActionButton className="button button-primary auth-submit" type="submit" isPending={isBusy} pendingLabel="Sending recovery link…">Send recovery instructions</ActionButton></>}
    <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>
  </form>;
}

export function ResetPasswordForm() {
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);

  useEffect(() => {
    const checkRecovery = async () => {
      try {
        const { data, error } = await createClient().auth.getClaims();
        setIsReady(Boolean(data?.claims) && !error);
      } catch {
        setIsReady(false);
      }
    };
    void checkRecovery();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    if (password !== confirmation) {
      setMessage("Your passwords do not match.");
      return;
    }

    pendingRef.current = true;
    setIsBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.assign("/sign-in?reset=complete");
    } catch {
      setMessage("This recovery link is no longer valid. Request another password reset.");
      setIsBusy(false);
      pendingRef.current = false;
    }
  }

  return <form className="auth-card" onSubmit={submit}>
    <div className="auth-card-heading"><p className="eyebrow">Account recovery</p><h1>Choose a new password.</h1><p>Use a strong password you do not reuse elsewhere.</p></div>
    {isReady === null && <InlineFeedback variant="info">Checking your recovery link…</InlineFeedback>}
    {isReady === false && <InlineFeedback variant="error"><strong>This recovery link is unavailable.</strong><p>It may have expired or already been used.</p><Link className="auth-inline-link" href="/forgot-password">Request another reset</Link></InlineFeedback>}
    {isReady && <><label className="field-label">New password<input name="password" type="password" autoComplete="new-password" required minLength={8} disabled={isBusy} /></label><label className="field-label">Confirm new password<input name="password_confirmation" type="password" autoComplete="new-password" required minLength={8} disabled={isBusy} /></label>{message && <InlineFeedback variant="error">{message}</InlineFeedback>}<ActionButton className="button button-primary auth-submit" type="submit" isPending={isBusy} pendingLabel="Updating password…">Update password</ActionButton></>}
    <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>
  </form>;
}
