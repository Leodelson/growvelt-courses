import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseRest } from "../_shared/supabase.ts";

type RegistrationPayment = {
  id: number;
  payment_amount: string | number | null;
  payment_currency: string | null;
};

function getRequiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizeReference(reference: string) {
  return reference.replace(/[^a-zA-Z0-9-.=]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { reference } = await req.json();
    if (!reference) return jsonResponse({ error: "Missing reference" }, 400);

    const cleanReference = normalizeReference(String(reference));
    const registrations = await supabaseRest(
      `course_registrations?paystack_reference=eq.${encodeURIComponent(cleanReference)}&select=id,payment_amount,payment_currency`,
    ) as RegistrationPayment[];

    const registration = registrations?.[0];
    if (!registration) return jsonResponse({ error: "Registration payment not found" }, 404);

    const secretKey = getRequiredSecret("PAYSTACK_SECRET_KEY");
    const response = await fetch(`https://api.paystack.co/transaction/verify/${cleanReference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const verification = await response.json();
    if (!response.ok || !verification.status) {
      throw new Error(verification.message || JSON.stringify(verification));
    }

    const expectedAmount = Math.round(Number(registration.payment_amount || 0) * 100);
    const expectedCurrency = registration.payment_currency || Deno.env.get("PAYSTACK_CURRENCY") || "NGN";
    const paidAmount = Number(verification.data?.amount || 0);
    const paidCurrency = verification.data?.currency || "";
    const status = verification.data?.status || "pending";
    const isPaid = status === "success";
    const amountMatches = expectedAmount > 0 && paidAmount === expectedAmount;
    const currencyMatches = paidCurrency === expectedCurrency;

    if (isPaid && (!amountMatches || !currencyMatches)) {
      await supabaseRest(`course_registrations?id=eq.${registration.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          payment_status: "payment_mismatch",
          paystack_transaction_id: String(verification.data?.id || ""),
          payer_email: verification.data?.customer?.email || null,
        }),
      });

      return jsonResponse({ error: "Payment amount or currency mismatch" }, 400);
    }

    await supabaseRest(`course_registrations?id=eq.${registration.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        payment_status: isPaid ? "paid" : status,
        paystack_transaction_id: String(verification.data?.id || ""),
        payer_email: verification.data?.customer?.email || null,
        paid_at: isPaid ? verification.data?.paid_at || new Date().toISOString() : null,
      }),
    });

    return jsonResponse({
      ok: true,
      status,
      reference: cleanReference,
      amount: verification.data?.amount,
      currency: paidCurrency,
    });
  } catch (error) {
    console.error(error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: "Paystack payment verification failed", details }, 500);
  }
});
