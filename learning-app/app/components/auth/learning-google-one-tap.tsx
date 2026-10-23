"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { learningPath } from "@/app/lib/site-urls.mjs";
import { createClient } from "@/app/lib/supabase/browser";
import { useLanguage } from "@/app/components/language-provider";
import styles from "./learning-google-one-tap.module.css";

type LearningIntent = "learn" | "teach";
type GoogleCredentialResponse = { credential: string };
type GoogleIdentityApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    context: "signin";
    auto_select: false;
    itp_support: true;
    use_fedcm_for_prompt: true;
    nonce: string;
  }) => void;
  prompt: () => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

const roleChoiceKey = "growvelt-learning:google-one-tap-role-choice";
const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { nonce, hashedNonce };
}

export function LearningGoogleOneTap() {
  const router = useRouter();
  const { t } = useLanguage();
  const [showRoleChoice, setShowRoleChoice] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const initialized = useRef(false);
  const pending = useRef(false);
  const nonce = useRef<string | null>(null);

  const completeSignIn = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential || pending.current) return;
    pending.current = true;
    setMessage("");
    setIsBusy(true);

    try {
      if (!nonce.current) throw new Error("Google sign-in nonce is unavailable.");
      const signInNonce = nonce.current;
      nonce.current = null;
      const { data, error } = await createClient().auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        nonce: signInNonce,
      });
      if (error || !data.user) throw error ?? new Error("Google sign-in did not return a user.");

      await fetch(learningPath("/api/auth/login-activity"), {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(3000),
      }).catch(() => undefined);

      const savedIntent = data.user.user_metadata?.growvelt_learning_intent;
      if (savedIntent === "learn" || savedIntent === "teach") {
        router.replace(learningPath(savedIntent === "teach" ? "/teach/apply" : "/dashboard"));
        return;
      }

      window.sessionStorage.setItem(roleChoiceKey, "1");
      setShowRoleChoice(true);
      setIsBusy(false);
      pending.current = false;
    } catch {
      setMessage("Google sign-in could not be completed. Please use the sign-in or Join for free option in the menu.");
      setIsBusy(false);
      pending.current = false;
    }
  }, [router]);

  const initializeOneTap = useCallback(async () => {
    if (!clientId || initialized.current || !window.google?.accounts.id) return;
    initialized.current = true;

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (window.sessionStorage.getItem(roleChoiceKey) === "1") setShowRoleChoice(true);
        return;
      }

      const noncePair = await makeNonce();
      nonce.current = noncePair.nonce;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => { void completeSignIn(response); },
        context: "signin",
        auto_select: false,
        itp_support: true,
        use_fedcm_for_prompt: true,
        nonce: noncePair.hashedNonce,
      });
      window.google.accounts.id.prompt();
    } catch {
      // One Tap is an optional entry point; the normal sign-in and join links remain available.
      initialized.current = false;
    }
  }, [completeSignIn]);

  async function chooseIntent(intent: LearningIntent) {
    if (pending.current) return;
    pending.current = true;
    setIsBusy(true);
    setMessage("");

    try {
      const { error } = await createClient().auth.updateUser({ data: { growvelt_learning_intent: intent } });
      if (error) throw error;
      window.sessionStorage.removeItem(roleChoiceKey);
      router.replace(learningPath(intent === "teach" ? "/teach/apply" : "/dashboard"));
    } catch {
      setMessage("Your account is ready, but we couldn’t save that choice. Please choose again.");
      setIsBusy(false);
      pending.current = false;
    }
  }

  if (!clientId && !showRoleChoice) return null;

  return <>
    {clientId && <Script id="google-identity-services" src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => { void initializeOneTap(); }} />}
    {message && !showRoleChoice && <p className={styles.status} role="status">{message}</p>}
    {showRoleChoice && <div className={styles.backdrop}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="one-tap-title" aria-describedby="one-tap-copy">
        <p className={styles.eyebrow}>Welcome to Growvelt</p>
        <h2 id="one-tap-title">What brings you here?</h2>
        <p id="one-tap-copy">Choose how you’d like to get started. You can change direction any time.</p>
        <div className={styles.choices}>
          <button autoFocus type="button" onClick={() => void chooseIntent("learn")} disabled={isBusy}>
            <strong>{t("auth.learn")}</strong><span>{t("auth.learnCopy")}</span>
          </button>
          <button type="button" onClick={() => void chooseIntent("teach")} disabled={isBusy}>
            <strong>{t("auth.teach")}</strong><span>{t("auth.teachCopy")}</span>
          </button>
        </div>
        {message && <p className={styles.dialogStatus} role="alert">{message}</p>}
        <button className={styles.later} type="button" onClick={() => void chooseIntent("learn")} disabled={isBusy}>Continue as a learner</button>
      </section>
    </div>}
  </>;
}
