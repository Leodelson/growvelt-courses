import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createPaystackTestTransferRecipient, resolvePaystackTestAccount } from "@/app/lib/payments/paystack";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

type ProfileResult = {
  payout_profile_id: number;
  status: "active" | "disabled";
  provider_domain: "test";
  recipient_code: string;
  bank_name: string;
  account_name: string;
  account_last4: string;
  created_at: string;
};

async function requireApprovedInstructor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ code: "unauthorized" }, { status: 401 }) } as const;
  const { data: approved, error } = await supabase.rpc("is_approved_growvelt_instructor");
  if (error || approved !== true) return { response: NextResponse.json({ code: "forbidden" }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET() {
  const auth = await requireApprovedInstructor();
  if ("response" in auth) return auth.response;
  // The read RPC intentionally derives auth.uid() from the signed-in session;
  // do not replace this with a service-role read that could lose ownership scope.
  const { data, error } = await (await createClient()).rpc("get_own_learning_instructor_payout_profiles");
  if (error) return NextResponse.json({ code: "profile_unavailable" }, { status: 503 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const auth = await requireApprovedInstructor();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { accountNumber?: unknown; bankCode?: unknown } | null;
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  if (!/^\d{10}$/.test(accountNumber) || !/^[A-Za-z0-9_-]{2,32}$/.test(bankCode)) return NextResponse.json({ code: "invalid_account_details" }, { status: 400 });
  try {
    const resolved = await resolvePaystackTestAccount({ accountNumber, bankCode });
    const recipient = await createPaystackTestTransferRecipient({ accountNumber, bankCode, accountName: resolved.accountName });
    const { data, error } = await createAdminClient().rpc("create_learning_instructor_paystack_test_payout_profile", {
      p_instructor_id: auth.user.id,
      p_recipient_code: recipient.recipientCode,
      p_provider_recipient_id: recipient.providerRecipientId,
      p_bank_code: recipient.bankCode,
      p_bank_name: recipient.bankName,
      p_account_name: recipient.accountName,
      p_account_last4: recipient.accountLast4,
      p_actor_user_id: auth.user.id,
    });
    if (error) throw error;
    const profile = (data as ProfileResult[] | null)?.[0];
    if (!profile) throw new Error("Profile was not created.");
    return NextResponse.json({ profile: { ...profile, accountNumber: undefined } }, { status: 201 });
  } catch (error) {
    // Provider responses are intentionally not copied to logs; they could
    // contain account-validation details. Keep only a stable diagnostic code.
    console.error("instructor.payout_profile_failed", { userId: auth.user.id, errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ code: "payout_profile_unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const auth = await requireApprovedInstructor();
  if ("response" in auth) return auth.response;
  const { data, error } = await createAdminClient().rpc("disable_own_learning_instructor_paystack_test_payout_profile", { p_instructor_id: auth.user.id, p_actor_user_id: auth.user.id });
  if (error) return NextResponse.json({ code: "profile_unavailable" }, { status: 503 });
  return NextResponse.json({ status: data === true ? "disabled" : "unchanged" });
}
