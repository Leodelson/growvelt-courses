import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";

const topics = new Set(["courses", "billing", "teaching", "organizations", "account", "other"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view Learning messages." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const { data: cases, error } = await supabase.from("learning_support_conversations")
    .select("id,subject,topic,status,updated_at,last_message_at")
    .eq("user_id", user.id).order("last_message_at", { ascending: false }).limit(4);
  if (error) return NextResponse.json({ error: "Learning messages are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });

  const conversations = await Promise.all((cases ?? []).map(async (item) => {
    const { data: latestMessage, error: messageError } = await supabase.from("learning_support_messages")
      .select("sender_role,body,created_at").eq("conversation_id", item.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (messageError) return null;
    return { ...item, latest_message: latestMessage?.body ?? null, latest_sender_role: latestMessage?.sender_role ?? null, latest_message_at: latestMessage?.created_at ?? null };
  }));
  if (conversations.some((item) => item === null)) return NextResponse.json({ error: "Learning messages are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ conversations }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to contact Learning support." }, { status: 401 });
  let input: Record<string, unknown>;
  try { input = await readBoundedJsonObject(request, 32 * 1024); }
  catch (error) { return NextResponse.json({ error: "Check the topic, subject, and message." }, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  const topic = typeof input?.topic === "string" ? input.topic : "";
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!topics.has(topic) || subject.length < 5 || subject.length > 160 || message.length < 20 || message.length > 5000) return NextResponse.json({ error: "Check the topic, subject, and message." }, { status: 400 });
  const { data, error } = await supabase.rpc("create_learning_support_case", { p_topic: topic, p_subject: subject, p_message: message });
  if (error) return NextResponse.json({ error: error.code === "22023" ? "Please review your message or wait before opening another request." : "We could not open your support request." }, { status: error.code === "22023" ? 429 : 503 });
  return NextResponse.json({ id: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
