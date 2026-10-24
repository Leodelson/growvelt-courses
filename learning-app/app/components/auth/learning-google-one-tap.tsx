"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { learningPath } from "@/app/lib/site-urls.mjs";
import { createClient } from "@/app/lib/supabase/browser";
import styles from "./learning-google-one-tap.module.css";

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
  const [message, setMessage] = useState("");
  const initialized = useRef(false);
  const pending = useRef(false);
  const nonce = useRef<string | null>(null);

  const completeSignIn = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential || pending.current) return;
    pending.current = true;
    setMessage("");

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

      window.sessionStorage.removeItem(roleChoiceKey);
      router.replace(learningPath("/dashboard"));
    } catch {
      setMessage("Google sign-in could not be completed. Please use the sign-in or Join for free option in the menu.");
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
        window.sessionStorage.removeItem(roleChoiceKey);
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

  if (!clientId) return null;

  return <>
    {clientId && <Script id="google-identity-services" src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => { void initializeOneTap(); }} />}
    {message && <p className={styles.status} role="status">{message}</p>}
  </>;
}
