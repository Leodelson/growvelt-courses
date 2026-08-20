"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  action: "sign_in" | "sign_up" | "password_recovery";
  onTokenChange: (token: string | null) => void;
  resetKey: number;
};

const scriptId = "growvelt-turnstile-script";

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile could not load."));
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({ action, onTokenChange, resetKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const isLocalDevelopment = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (!siteKey || isLocalDevelopment || !containerRef.current) return;
    let cancelled = false;
    onTokenChange(null);

    void loadTurnstile().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        size: window.matchMedia("(max-width: 420px)").matches ? "compact" : "flexible",
        callback: (token: string) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null),
      });
    }).catch(() => onTokenChange(null));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [action, isLocalDevelopment, onTokenChange, resetKey, siteKey]);

  if (!siteKey || isLocalDevelopment) return null;
  return <div className="turnstile-field"><span>Security check</span><div className="turnstile-widget" ref={containerRef} /></div>;
}
