export async function verifyTurnstileToken(token: string | null, action: "sign_in" | "sign_up" | "password_recovery") {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return { ok: true } as const;
  if (!token) return { ok: false, message: "Complete the security check before continuing." } as const;
  const response = await fetch("/api/auth/verify-turnstile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action }) });
  const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
  return result?.ok ? { ok: true } as const : { ok: false, message: result?.message ?? "Security verification could not be confirmed. Please try again." } as const;
}
