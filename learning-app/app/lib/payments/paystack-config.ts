export type PaystackMode = "test" | "live";
export type PaystackEnvironment = Record<string, string | undefined>;
export type PaystackConfiguration = {
  mode: PaystackMode;
  secretKey: string;
  callbackUrl: string;
  checkoutEnabled: boolean;
  refundsEnabled: boolean;
};

/**
 * Resolves only server environment. It intentionally never returns a value to
 * browser code or error responses. PAYSTACK_SECRET_KEY remains a test-only
 * compatibility name until it is removed during the approved live cutover.
 */
export function resolvePaystackConfiguration(environment: PaystackEnvironment): PaystackConfiguration {
  const mode = environment.PAYSTACK_MODE?.trim();
  const legacyTestSecret = environment.PAYSTACK_SECRET_KEY?.trim();
  const testSecret = environment.PAYSTACK_TEST_SECRET_KEY?.trim();
  const liveSecret = environment.PAYSTACK_LIVE_SECRET_KEY?.trim();
  const callbackUrl = environment.PAYSTACK_CALLBACK_URL?.trim();
  const checkoutEnabled = environment.PAYMENTS_CHECKOUT_ENABLED === "true";
  const refundsEnabled = environment.PAYMENTS_REFUNDS_ENABLED === "true";

  if (mode !== "test" && mode !== "live") throw new Error("Paystack mode must be test or live.");
  if (legacyTestSecret && testSecret) throw new Error("Configure only one Paystack test secret key.");
  if (mode === "test" && liveSecret) throw new Error("A live Paystack secret must not be present in test mode.");
  if (mode === "live" && (legacyTestSecret || testSecret)) throw new Error("A test Paystack secret must not be present in live mode.");

  const secretKey = mode === "test" ? (testSecret ?? legacyTestSecret) : liveSecret;
  const expectedPrefix = mode === "test" ? "sk_test_" : "sk_live_";
  if (!secretKey?.startsWith(expectedPrefix)) throw new Error(`Paystack ${mode} secret key is not configured.`);
  if (!callbackUrl) throw new Error("Paystack callback URL is not configured.");

  const parsedCallback = new URL(callbackUrl);
  if (!(parsedCallback.protocol === "http:" || parsedCallback.protocol === "https:")) throw new Error("Paystack callback URL is invalid.");
  if (mode === "live" && (parsedCallback.protocol !== "https:" || parsedCallback.hostname !== "learn.growvelt.com" || parsedCallback.pathname !== "/payments/paystack/callback")) {
    throw new Error("Paystack live callback URL must be the Growvelt Learning HTTPS callback.");
  }

  return { mode, secretKey, callbackUrl: parsedCallback.href, checkoutEnabled, refundsEnabled };
}
