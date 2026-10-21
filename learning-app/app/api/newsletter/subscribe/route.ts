import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJson } from "@/app/lib/security/json-body";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "This request was not accepted." }, { status: 403 });
  let body: unknown;
  try {
    body = await readBoundedJson(request, 1024);
  } catch (error) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: error instanceof JsonBodyError ? error.status : 400 });
  }

  const rawEmail = typeof body === "object" && body !== null && "email" in body ? (body as { email?: unknown }).email : undefined;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email || email.length > 254 || !emailPattern.test(email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  const { error } = await (await createClient()).from("newsletter_subscribers").insert({
    email,
    source_page: "growvelt-learning-footer",
  });

  if (error?.code === "PT429") return NextResponse.json({ message: "We’ve received too many sign-up requests. Please try again later." }, { status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } });
  if (error?.code === "22023") return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  // Do not disclose whether an address is already subscribed.
  if (error?.code === "23505") return NextResponse.json({ message: "Thanks. Your subscription request has been received." }, { status: 202 });
  if (error) return NextResponse.json({ message: "We couldn’t save your subscription. Please try again." }, { status: 500 });

  return NextResponse.json({ message: "Thanks. Your subscription request has been received." }, { status: 202 });
}
