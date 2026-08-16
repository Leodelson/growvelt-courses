import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inquiryKinds = new Set(["contact", "partnership"]);

function field(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid payload");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Please complete the form and try again." }, { status: 400 });
  }

  const kind = field(body.kind, 32);
  const name = field(body.name, 160);
  const email = field(body.email, 254).toLowerCase();
  const subject = field(body.subject, 160);
  const message = field(body.message, 5000);
  const organization = field(body.organization, 160);
  const phone = field(body.phone, 32);
  const website = field(body.website, 200);

  if (!inquiryKinds.has(kind) || name.length < 2 || !emailPattern.test(email) || subject.length < 2 || message.length < 20) {
    return NextResponse.json({ message: "Please complete the required fields with a valid email and message." }, { status: 400 });
  }

  if (kind === "partnership" && organization.length < 2) {
    return NextResponse.json({ message: "Please include your organization so we can review the partnership request." }, { status: 400 });
  }

  const { error } = await (await createClient()).rpc("submit_public_learning_inquiry", {
    p_inquiry_type: kind,
    p_name: name,
    p_email: email,
    p_subject: subject,
    p_message: message,
    p_organization: organization || null,
    p_phone: phone || null,
    p_website: website || null,
  });

  if (error) {
    if (error.code === "22023") return NextResponse.json({ message: "Please review the form and try again." }, { status: 400 });
    return NextResponse.json({ message: "We couldn’t send your message right now. Please try again or use one of the direct support channels." }, { status: 500 });
  }

  return NextResponse.json({ message: kind === "partnership" ? "Thanks. Your partnership request has been received." : "Thanks. Your message has been sent to Growvelt." }, { status: 201 });
}
