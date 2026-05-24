import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseRest } from "../_shared/supabase.ts";

type Registration = {
  id: number;
  registration_ref: string;
  full_name: string;
  email: string;
  course: string;
};

function getRequiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getCourseAmount(course: string) {
  const pricesJson = Deno.env.get("COURSE_PRICES_JSON");
  if (!pricesJson) {
    throw new Error("Missing COURSE_PRICES_JSON");
  }

  const prices = JSON.parse(pricesJson) as Record<string, string | number>;
  const amount = prices[course];
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`No valid price configured for ${course}`);
  }

  return numericAmount;
}

function toSubunitAmount(amount: number) {
  return Math.round(amount * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { registrationRef } = await req.json();
    if (!registrationRef) return jsonResponse({ error: "Missing registrationRef" }, 400);

    const registrations = await supabaseRest(
      `course_registrations?registration_ref=eq.${encodeURIComponent(registrationRef)}&select=id,registration_ref,full_name,email,course`,
    ) as Registration[];

    const registration = registrations?.[0];
    if (!registration) return jsonResponse({ error: "Registration not found" }, 404);

    const secretKey = getRequiredSecret("PAYSTACK_SECRET_KEY");
    const currency = Deno.env.get("PAYSTACK_CURRENCY") || "NGN";
    const amount = getCourseAmount(registration.course);
    const siteUrl = (Deno.env.get("SITE_URL") || "https://courses.growvelt.com").replace(/\/$/, "");
    const reference = `GC-${registration.registration_ref.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}-${Date.now()}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: registration.email,
        amount: String(toSubunitAmount(amount)),
        currency,
        reference,
        callback_url: `${siteUrl}/paystack-callback.html`,
        metadata: {
          registration_ref: registration.registration_ref,
          full_name: registration.full_name,
          course: registration.course,
        },
      }),
    });

    const transaction = await response.json();
    if (!response.ok || !transaction.status) {
      throw new Error(transaction.message || JSON.stringify(transaction));
    }

    await supabaseRest(`course_registrations?id=eq.${registration.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        paystack_reference: transaction.data.reference,
        paystack_access_code: transaction.data.access_code,
        payment_amount: amount,
        payment_currency: currency,
        payment_status: "paystack_initialized",
      }),
    });

    return jsonResponse({
      reference: transaction.data.reference,
      authorizationUrl: transaction.data.authorization_url,
    });
  } catch (error) {
    console.error(error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: "Paystack transaction initialization failed", details }, 500);
  }
});
