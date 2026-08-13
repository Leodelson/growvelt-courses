import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
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

  if (error?.code === "23505") return NextResponse.json({ message: "You are already subscribed." });
  if (error) return NextResponse.json({ message: "We couldn’t save your subscription. Please try again." }, { status: 500 });

  return NextResponse.json({ message: "Thanks! You subscribed to Growvelt updates." }, { status: 201 });
}
