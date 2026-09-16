import { createClient } from "@/app/lib/supabase/server";

export type InstructorEarning = {
  earning_id: number;
  allocation_id: number;
  order_id: number;
  order_reference: string;
  course_id: number | null;
  course_title: string;
  order_paid_at: string | null;
  gross_amount_minor: number;
  platform_commission_minor: number;
  instructor_gross_minor: number;
  currency: "NGN";
  earning_status: "held" | "available" | "reserved" | "paid" | "reversed" | "recoverable";
  available_at: string;
  released_at: string | null;
  reversed_at: string | null;
  recoverable_amount_minor: number;
  hold_reason: string | null;
  commercial_terms_version: string;
  allocated_at: string;
};

export type InstructorEarningEvent = {
  event_id: number;
  earning_id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  occurred_at: string;
};

export async function getOwnInstructorEarnings() {
  const supabase = await createClient();
  const [earningsResult, eventsResult] = await Promise.all([
    supabase.rpc("get_own_learning_instructor_earnings"),
    supabase.rpc("list_own_learning_instructor_earning_events"),
  ]);
  if (earningsResult.error || eventsResult.error) throw new Error("Unable to load Instructor earnings.");
  return {
    earnings: (earningsResult.data ?? []) as InstructorEarning[],
    events: (eventsResult.data ?? []) as InstructorEarningEvent[],
  };
}
