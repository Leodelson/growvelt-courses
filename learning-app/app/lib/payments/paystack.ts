import "server-only";
import { isTrustedPaystackAuthorizationUrl } from "@/app/lib/payments/paystack-core";

export {
  digestPaystackPayload,
  isTrustedPaystackAuthorizationUrl,
  parsePaystackTestChargeSuccess,
  verifyPaystackSignature,
} from "@/app/lib/payments/paystack-core";

export type PaystackTestConfig = { secretKey: string; callbackUrl: string; checkoutEnabled: boolean };

export function getPaystackTestConfig(requireCheckout = false): PaystackTestConfig {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const mode = process.env.PAYSTACK_MODE?.trim();
  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL?.trim();
  const checkoutEnabled = process.env.PAYMENTS_CHECKOUT_ENABLED === "true";
  if (mode !== "test" || !secretKey?.startsWith("sk_test_") || !callbackUrl) throw new Error("Paystack test mode is not configured.");
  const parsedCallback = new URL(callbackUrl);
  if (!(["http:", "https:"].includes(parsedCallback.protocol))) throw new Error("Paystack callback URL is invalid.");
  if (requireCheckout && !checkoutEnabled) throw new Error("Paystack test checkout is disabled.");
  return { secretKey, callbackUrl: parsedCallback.href, checkoutEnabled };
}

export async function initializePaystackTestTransaction(input: { email: string; amountMinor: number; reference: string; callbackUrl: string }) {
  const { secretKey } = getPaystackTestConfig(true);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ email: input.email, amount: String(input.amountMinor), currency: "NGN", reference: input.reference, callback_url: input.callbackUrl, metadata: { product: "growvelt_learning", order_reference: input.reference, environment: "test" } }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null) as { status?: unknown; message?: unknown; data?: { authorization_url?: unknown; reference?: unknown } } | null;
  const authorizationUrl = typeof result?.data?.authorization_url === "string" ? result.data.authorization_url : "";
  if (!response.ok || result?.status !== true || !isTrustedPaystackAuthorizationUrl(authorizationUrl) || result.data?.reference !== input.reference) throw new Error(typeof result?.message === "string" ? result.message : "Paystack initialization failed.");
  return { authorizationUrl };
}
