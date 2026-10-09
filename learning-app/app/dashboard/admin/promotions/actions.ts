"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLearningAdmin } from "@/app/lib/admin/authorization";
import { createClient } from "@/app/lib/supabase/server";

const pagePath = "/dashboard/admin/promotions";

function amountToMinor(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function dateValue(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  // The admin workspace operates in Nigeria; datetime-local has no timezone
  // marker, so persist its wall-clock value explicitly as Africa/Lagos (UTC+1).
  const date = new Date(value + "+01:00");
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function errorRedirect(code: string): never {
  redirect(pagePath + "?error=" + encodeURIComponent(code));
}

export async function createLearningCouponAction(formData: FormData) {
  if (!await isLearningAdmin()) redirect("/dashboard");

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const kind = String(formData.get("discountKind") ?? "");
  const rawValue = String(formData.get("discountValue") ?? "").trim();
  const discountValue = kind === "percentage"
    ? (/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(rawValue) ? Math.round(Number(rawValue) * 100) : null)
    : amountToMinor(rawValue);
  const maxDiscountMinor = amountToMinor(formData.get("maxDiscount"));
  const minimumChargeMinor = amountToMinor(formData.get("minimumCharge"));
  const startsAt = dateValue(formData.get("startsAt"));
  const endsAt = dateValue(formData.get("endsAt"));
  const rawLimit = String(formData.get("maxRedemptions") ?? "").trim();
  const maxRedemptions = rawLimit === "" ? null : (/^[1-9]\d{0,5}$/.test(rawLimit) ? Number(rawLimit) : Number.NaN);
  const courseIds = formData.getAll("courseIds").map((item) => typeof item === "string" ? Number(item) : Number.NaN);

  if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(code) || !["fixed", "percentage"].includes(kind)
      || discountValue === null || !Number.isSafeInteger(discountValue) || discountValue <= 0
      || maxDiscountMinor === null || minimumChargeMinor === null || !startsAt || !endsAt
      || new Date(startsAt) >= new Date(endsAt) || !Number.isSafeInteger(maxRedemptions ?? 1)
      || (maxRedemptions !== null && (maxRedemptions < 1 || maxRedemptions > 999999))
      || courseIds.length < 1 || courseIds.length > 20
      || courseIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
      || new Set(courseIds).size !== courseIds.length) {
    errorRedirect("invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_learning_promotion_coupon_for_admin", {
    p_code: code,
    p_discount_kind: kind,
    p_discount_value: discountValue,
    p_max_discount_minor: maxDiscountMinor,
    p_minimum_charge_minor: minimumChargeMinor,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_max_redemptions: maxRedemptions,
    p_course_ids: courseIds,
  });

  if (error) {
    if (error.code === "23505") errorRedirect("duplicate");
    if (error.code === "42501") redirect("/dashboard");
    errorRedirect(error.code === "22023" ? "invalid" : "unavailable");
  }
  revalidatePath(pagePath);
  redirect(pagePath + "?created=1");
}

export async function disableLearningCouponAction(formData: FormData) {
  if (!await isLearningAdmin()) redirect("/dashboard");
  const couponId = Number(formData.get("couponId"));
  if (!Number.isSafeInteger(couponId) || couponId <= 0) errorRedirect("unavailable");
  const { error } = await (await createClient()).rpc("disable_learning_promotion_coupon_for_admin", {
    p_coupon_id: couponId,
  });
  if (error) errorRedirect("unavailable");
  revalidatePath(pagePath);
  redirect(pagePath + "?disabled=1");
}
