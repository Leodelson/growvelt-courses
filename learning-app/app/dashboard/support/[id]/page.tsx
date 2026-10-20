import { notFound, redirect } from "next/navigation";
import { SupportConversation } from "./conversation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { createClient } from "@/app/lib/supabase/server";

export const metadata = { title: "Support request" };
export const dynamic = "force-dynamic";

export default async function SupportConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/dashboard/support/${id}`)}`);
  const { data: caseRecord, error } = await supabase.from("learning_support_conversations").select("id,user_id,topic,subject,status,created_at,updated_at").eq("id", id).maybeSingle();
  if (error || !caseRecord) notFound();
  const { data: messages, error: messagesError } = await supabase.from("learning_support_messages").select("id,sender_role,body,created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(200);
  if (messagesError || !messages) notFound();
  const isAdmin = await isLearningAdmin();
  return <SupportConversation initialCase={caseRecord} initialMessages={messages} isAdmin={isAdmin} />;
}
