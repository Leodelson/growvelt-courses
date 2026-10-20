import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";

const topics = new Set(["courses", "billing", "teaching", "organizations", "account", "other"]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to contact Learning support." }, { status: 401 });
  const input = await request.json().catch(() => null) as { topic?: unknown; subject?: unknown; message?: unknown } | null;
  const topic = typeof input?.topic === "string" ? input.topic : "";
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!topics.has(topic) || subject.length < 5 || subject.length > 160 || message.length < 20 || message.length > 5000) return NextResponse.json({ error: "Check the topic, subject, and message." }, { status: 400 });
  const { data, error } = await supabase.rpc("create_learning_support_case", { p_topic: topic, p_subject: subject, p_message: message });
  if (error) return NextResponse.json({ error: error.code === "22023" ? "Please review your message or wait before opening another request." : "We could not open your support request." }, { status: error.code === "22023" ? 429 : 503 });
  return NextResponse.json({ id: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
