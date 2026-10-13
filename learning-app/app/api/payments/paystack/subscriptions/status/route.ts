import { NextResponse } from "next/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { digestPaystackPayload, verifyPaystackTestSubscriptionTransaction } from "@/app/lib/payments/paystack";

const REFERENCE_PATTERN = /^GS-[A-F0-9]{32}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ code: "not_signed_in" }, { status: 401 });
  const reference = new URL(request.url).searchParams.get("reference")?.trim() ?? "";
  if (!REFERENCE_PATTERN.test(reference)) return NextResponse.json({ code: "invalid_reference" }, { status: 400 });

  const loadStatus = async () => {
    const { data, error } = await supabase.rpc("get_own_learning_subscription_payment_status", { p_reference: reference });
    if (error) {
      console.error("subscription.callback_status_failed", { learnerId: user.id, code: error.code });
      return { status: null, failed: true };
    }
    return {
      status: (data as Array<{ invoice_status?: string; subscription_status?: string; access_active?: boolean }> | null)?.[0] ?? null,
      failed: false,
    };
  };

  let { status, failed } = await loadStatus();
  if (failed) return NextResponse.json({ code: "status_unavailable" }, { status: 503 });
  if (!status) return NextResponse.json({ code: "not_found" }, { status: 404 });

  let confirmationStatus: "pending" | "failed" | undefined;
  if (status.access_active !== true && ["created", "payment_pending", "failed"].includes(status.invoice_status ?? "")) {
    try {
      // The callback's reference is only a lookup key. Access is granted only
      // after Paystack's Test Mode API confirms the exact transaction and the
      // service-only RPC matches it to this learner's invoice and metadata.
      const verified = await verifyPaystackTestSubscriptionTransaction(reference);
      if (verified.status === "success") {
        if (!verified.subscriptionId || !verified.invoiceId
          || verified.amountMinor < verified.requestedAmountMinor) {
          console.warn("subscription.provider_api_reconciliation_ineligible", { reason: "transaction_identity_or_amount_mismatch" });
        } else {
          const verifiedPayload = {
            status: verified.status,
            reference: verified.reference,
            transaction_id: verified.transactionId,
            amount_minor: verified.requestedAmountMinor,
            requested_amount_minor: verified.requestedAmountMinor,
            charged_amount_minor: verified.amountMinor,
            fees_minor: verified.feesMinor,
            currency: verified.currency,
            domain: verified.domain,
            paid_at: verified.paidAt,
            metadata: {
              subscription_id: verified.subscriptionId,
              invoice_id: verified.invoiceId,
            },
          };
          const admin = createAdminClient();
          const { data: reconciliation, error: reconciliationError } = await admin.rpc(
            "reconcile_own_learning_test_subscription_payment",
            {
              p_learner_id: user.id,
              p_reference: reference,
              p_subscription_id: verified.subscriptionId,
              p_invoice_id: verified.invoiceId,
              p_provider_transaction_id: verified.transactionId,
              p_amount_minor: verified.amountMinor,
              p_requested_amount_minor: verified.requestedAmountMinor,
              p_fees_minor: verified.feesMinor,
              p_payload_digest: digestPaystackPayload(JSON.stringify(verifiedPayload)),
              p_verified_payload: verifiedPayload,
            },
          );
          const result = (reconciliation as Array<{ outcome?: string }> | null)?.[0];
          if (reconciliationError || !result?.outcome || ![
            "processed", "already_processed", "already_paid",
          ].includes(result.outcome)) {
            console.error("subscription.provider_api_reconciliation_deferred", {
              code: reconciliationError?.code ?? result?.outcome ?? "missing_result",
            });
          } else {
            ({ status, failed } = await loadStatus());
            if (failed) return NextResponse.json({ code: "status_unavailable" }, { status: 503 });
            if (!status) return NextResponse.json({ code: "not_found" }, { status: 404 });
          }
        }
      } else if (["failed", "abandoned"].includes(verified.status)) {
        confirmationStatus = "failed";
      }
    } catch {
      // Paystack can still be processing, or temporarily unreachable. Keep
      // this same reference pending; never infer success from a browser return.
      confirmationStatus = "pending";
    }
  }

  const finalStatus = status;
  if (!finalStatus) return NextResponse.json({ code: "not_found" }, { status: 404 });
  return NextResponse.json({
    invoiceStatus: finalStatus.invoice_status,
    subscriptionStatus: finalStatus.subscription_status,
    accessActive: finalStatus.access_active === true,
    ...(confirmationStatus ? { confirmationStatus } : {}),
  }, { headers: { "Cache-Control": "no-store" } });
}
