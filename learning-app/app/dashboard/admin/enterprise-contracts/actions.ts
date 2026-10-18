"use server";
import { learningPath } from "@/app/lib/site-urls.mjs";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { createClient } from "@/app/lib/supabase/server";

const pagePath = "/dashboard/admin/enterprise-contracts";

function errorRedirect(code: string): never {
  redirect(`${pagePath}?error=${encodeURIComponent(code)}`);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function recordLearningEnterpriseContractAction(formData: FormData) {
  if (!await isLearningAdmin()) redirect(learningPath("/dashboard"));

  const workspaceId = Number(String(formData.get("workspaceId") ?? "").trim());
  const reference = String(formData.get("contractReference") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const rawEndsOn = String(formData.get("endsOn") ?? "").trim();
  const endsOn = rawEndsOn || null;
  const seatCap = Number(String(formData.get("seatCap") ?? "").trim());
  const scopeSummary = String(formData.get("scopeSummary") ?? "").trim();
  const executedExternally = formData.get("executedExternally") === "on";

  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0
      || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,99}$/.test(reference)
      || !isCalendarDate(startsOn) || (endsOn !== null && !isCalendarDate(endsOn))
      || (endsOn !== null && endsOn < startsOn)
      || !Number.isSafeInteger(seatCap) || seatCap < 1 || seatCap > 100000
      || scopeSummary.length < 10 || scopeSummary.length > 500
      || !executedExternally) {
    errorRedirect("invalid");
  }

  const { error } = await (await createClient()).rpc("record_learning_enterprise_contract_for_admin", {
    p_workspace_id: workspaceId,
    p_contract_reference: reference,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_seat_cap: seatCap,
    p_scope_summary: scopeSummary,
    p_executed_externally: executedExternally,
  });

  if (error) {
    if (error.code === "42501") redirect(learningPath("/dashboard"));
    if (error.code === "23505") errorRedirect("duplicate");
    errorRedirect(error.code === "22023" ? "invalid" : "unavailable");
  }

  revalidatePath(pagePath);
  redirect(`${pagePath}?recorded=1`);
}
