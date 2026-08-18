import { NextResponse } from "next/server";

const actions = new Set(["sign_in", "sign_up", "password_recovery"]);

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return NextResponse.json({ ok: false, message: "Security verification is not configured." }, { status: 503 });

  try {
    const { token, action } = await request.json() as { token?: unknown; action?: unknown };
    if (typeof token !== "string" || !token || typeof action !== "string" || !actions.has(action)) {
      return NextResponse.json({ ok: false, message: "Complete the security check and try again." }, { status: 400 });
    }

    const formData = new FormData();
    formData.set("secret", secret);
    formData.set("response", token);
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
    const result = await verification.json() as { success?: boolean; action?: string; hostname?: string };
    const hostname = new URL(request.url).hostname;
    if (!result.success || result.action !== action || (hostname !== "localhost" && result.hostname !== hostname)) {
      return NextResponse.json({ ok: false, message: "Security verification could not be confirmed. Please try again." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, message: "Security verification could not be confirmed. Please try again." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
