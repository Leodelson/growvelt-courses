import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isLearningBrowserOrigin } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { isLearningNotificationVisible, LOGIN_NOTIFICATION_KIND } from "@/app/lib/learning/notification-retention";

const notificationColumns = "id,kind,title,body,href,created_at,read_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [notificationsResult, loginResult, unreadResult] = await Promise.all([
    supabase.from("learning_notifications").select(notificationColumns).eq("user_id", user.id)
      .neq("kind", LOGIN_NOTIFICATION_KIND).order("created_at", { ascending: false }).limit(20),
    supabase.from("learning_notifications").select(notificationColumns).eq("user_id", user.id)
      .eq("kind", LOGIN_NOTIFICATION_KIND).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("learning_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .neq("kind", LOGIN_NOTIFICATION_KIND).is("read_at", null),
  ]);
  if (notificationsResult.error || loginResult.error) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });
  const notifications = notificationsResult.data ?? [];
  const latestLogin = loginResult.data;
  const unreadCount = (unreadResult.error ? notifications.filter((item) => !item.read_at).length : unreadResult.count ?? 0)
    + (latestLogin && !latestLogin.read_at ? 1 : 0);
  if (latestLogin && isLearningNotificationVisible(latestLogin, Date.now())) {
    notifications.push(latestLogin);
    notifications.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  }
  return NextResponse.json({ notifications: notifications.slice(0, 20), unread_count: unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isLearningBrowserOrigin(request)) return new NextResponse(null, { status: 403 });
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
