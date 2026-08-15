import { createClient } from "@/app/lib/supabase/server";

type RpcError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export type AdminInstructorApplication = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  teaching_experience: string | null;
  motivation: string | null;
  portfolio_url: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  total_applications?: number;
};

function throwAdminReaderError(message: string, error: RpcError): never {
  if (process.env.NODE_ENV !== "production") {
    const diagnostic = {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    };

    console.error("Growvelt Learning Admin reader RPC failed", diagnostic);
    throw new Error(`${message} ${JSON.stringify(diagnostic)}`);
  }

  throw new Error(message);
}

export async function getPendingInstructorApplications() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_pending_instructor_applications");

  if (error) throwAdminReaderError("Unable to load Instructor applications.", error);
  return (data ?? []) as AdminInstructorApplication[];
}

export async function searchPendingInstructorApplications(query: string, page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.min(page, 100000) : 1;
  const { data, error } = await (await createClient()).rpc("search_pending_instructor_applications", {
    p_query: query || null,
    p_limit: 12,
    p_offset: (safePage - 1) * 12,
  });
  if (error) throwAdminReaderError("Unable to search Instructor applications.", error);
  const applications = (data ?? []) as AdminInstructorApplication[];
  return { applications, total: applications[0]?.total_applications ?? 0, page: safePage, pageSize: 12 };
}

export async function getInstructorApplicationForAdmin(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_instructor_application_for_review", { p_application_user_id: userId })
    .maybeSingle();

  if (error) throwAdminReaderError("Unable to load this Instructor application.", error);
  return data as AdminInstructorApplication | null;
}
