import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { LOGIN_NOTIFICATION_KIND, LOGIN_NOTIFICATION_RETENTION_MS } from "@/app/lib/learning/notification-retention";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const readCutoff = new Date(Date.now() - LOGIN_NOTIFICATION_RETENTION_MS).toISOString();
  const [notificationsResult, unreadResult] = await Promise.all([
    supabase.from("learning_notifications").select("id,kind,title,body,href,created_at,read_at").or(`kind.neq.${LOGIN_NOTIFICATION_KIND},read_at.is.null,read_at.gt.${readCutoff}`).order("created_at", { ascending: false }).limit(20),
    supabase.from("learning_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (notificationsResult.error) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });
  const notifications = notificationsResult.data ?? [];
  return NextResponse.json({ notifications, unread_count: unreadResult.error ? notifications.filter((item) => !item.read_at).length : unreadResult.count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request, 1024); }
  catch (error) { return new NextResponse(null, { status: error instanceof JsonBodyError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } }); }
  if (typeof body?.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)) return new NextResponse(null, { status: 400 });
  const { error } = await supabase.from("learning_notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", user.id);
  if (error) return new NextResponse(null, { status: 503 });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
