import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

const validToken = (value: string | null) => value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Growvelt Learning email preferences</title></head><body style="font:16px system-ui;max-width:620px;margin:10vh auto;padding:24px"><h1>Email preferences</h1>${body}</body></html>`;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validToken(token)) return new NextResponse(page("<p>This link is invalid.</p>"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  return new NextResponse(page(`<p>Stop receiving optional Growvelt Learning marketing emails? Account and course notices are unaffected.</p><form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>`), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || !validToken(token)) return new NextResponse(page("<p>This link is invalid.</p>"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  const { error } = await createAdminClient().from("learning_email_preferences").update({ marketing_opt_in: false, changed_at: new Date().toISOString() }).eq("unsubscribe_token", token);
  if (error) return new NextResponse(page("<p>We could not save your preference. Please try again.</p>"), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return new NextResponse(page("<p>You are unsubscribed from optional Growvelt Learning marketing emails.</p>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
