import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

const validToken = (value: string | null) => value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Growvelt Learning email preferences</title></head><body style="font:16px system-ui;max-width:620px;margin:10vh auto;padding:24px"><h1>Email preferences</h1>${body}</body></html>`;
class UnsubscribeBodyError extends Error {
  constructor(public status: number) { super("Invalid unsubscribe request"); }
}
async function readToken(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") throw new UnsubscribeBodyError(415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new UnsubscribeBodyError(400);
  if (length !== null && Number(length) > 1024) throw new UnsubscribeBodyError(413);
  if (!request.body) throw new UnsubscribeBodyError(400);
  const reader = request.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > 1024) throw new UnsubscribeBodyError(413);
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const form = new URLSearchParams(text);
    if (form.getAll("token").length !== 1) throw new UnsubscribeBodyError(400);
    return form.get("token");
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error instanceof UnsubscribeBodyError ? error : new UnsubscribeBodyError(400);
  } finally { reader.releaseLock(); }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validToken(token)) return new NextResponse(page("<p>This link is invalid.</p>"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  return new NextResponse(page(`<p>Stop receiving optional Growvelt Learning marketing emails? Account and course notices are unaffected.</p><form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>`), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request) {
  let token: string | null;
  try { token = await readToken(request); }
  catch (error) { return new NextResponse(page("<p>This unsubscribe request could not be accepted. Please reopen your email link.</p>"), { status: error instanceof UnsubscribeBodyError ? error.status : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
  if (typeof token !== "string" || !validToken(token)) return new NextResponse(page("<p>This link is invalid.</p>"), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const { error } = await createAdminClient().rpc("unsubscribe_learning_email_token", { p_token: token });
  if (error) return new NextResponse(page("<p>We could not save your preference. Please try again.</p>"), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  return new NextResponse(page("<p>Your unsubscribe request has been processed for optional Growvelt Learning marketing emails. Account and course notices are unaffected.</p>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
