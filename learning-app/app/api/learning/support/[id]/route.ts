import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { scheduleAdminSubmissionAlerts } from "@/app/lib/email/admin-submission-runtime";

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
type Context = { params: Promise<{ id: string }> };
export const maxDuration=60;

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!validId(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { data: caseRecord, error } = await supabase.from("learning_support_conversations").select("id,user_id,topic,subject,status,created_at,updated_at").eq("id", id).maybeSingle();
  if (error || !caseRecord) return new NextResponse(null, { status: 404 });
  const messages = await supabase.from("learning_support_messages").select("id,sender_role,body,created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(200);
  if (messages.error) return NextResponse.json({ error: "Messages could not be loaded." }, { status: 503 });
  return NextResponse.json({ case: caseRecord, messages: messages.data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!validId(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  let input: Record<string, unknown>;
  try { input = await readBoundedJsonObject(request, 32 * 1024); }
  catch (error) { return NextResponse.json({ error: "Write a message of up to 5,000 characters." }, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!message || message.length > 5000) return NextResponse.json({ error: "Write a message of up to 5,000 characters." }, { status: 400 });
  const { error } = await supabase.rpc("post_learning_support_message", { p_conversation_id: id, p_message: message });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "You cannot reply to this request." : error.code === "22023" ? "Please wait before sending another message." : "Your reply could not be sent." }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 429 : 503 });
  scheduleAdminSubmissionAlerts();
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const { id } = await params;
  if (!validId(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { error } = await supabase.rpc("resolve_learning_support_case", { p_conversation_id: id });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "Admin access required." : "This request could not be resolved." }, { status: error.code === "42501" ? 403 : 503 });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
