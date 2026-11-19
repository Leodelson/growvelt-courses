import { bindings, defineConfig, defineWorker } from "cf/config";

const productionTextBindingNames = [
  "ADMIN_FROM_EMAIL",
  "GROWVELT_LEARNING_SUBSCRIPTIONS_ENABLED",
  "GROWVELT_LEARNING_SUBSCRIPTION_TEST_CHECKOUT_ENABLED",
  "GROWVELT_LEARNING_SUBSCRIPTION_TEST_LEARNER_EMAILS",
  "GROWVELT_LEARNING_SUBSCRIPTION_TEST_LIFECYCLE_ENABLED",
  "GROWVELT_LEARNING_SUBSCRIPTION_TEST_PLAN_CREATION_ENABLED",
  "LEARNING_ADMIN_ALERT_DAILY_LIMIT",
  "LEARNING_ADMIN_ALERTS_ENABLED",
  "LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS",
  "LEARNING_EMAIL_CENTER_RECOVERY",
  "LEARNING_EMAIL_CENTER_RELEASE",
  "LEARNING_EMAIL_CENTER_TEST_RECIPIENTS",
  "LEARNING_EMAIL_VERIFIED_DOMAINS",
  "LEARNING_FROM_EMAIL",
  "LEARNING_LEGACY_PAGE_REDIRECT_ENABLED",
  "LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED",
  "LEARNING_LIVE_PAYOUT_PROFILE_SETUP_ENABLED",
  "LEARNING_WWW_SAFETY_BRIDGE_ENABLED",
  "NEXT_PUBLIC_CAREERS_SITE_URL",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED",
  "NEXT_PUBLIC_LEARNING_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NOREPLY_FROM_EMAIL",
  "PARTNERSHIPS_FROM_EMAIL",
  "PAYMENTS_CHECKOUT_ENABLED",
  "PAYMENTS_LIVE_LEARNER_CHECKOUT_ENABLED",
  "PAYMENTS_LIVE_REFUNDS_ENABLED",
  "PAYMENTS_REFUNDS_ENABLED",
  "PAYMENTS_TEST_COUPONS_ENABLED",
  "PAYSTACK_CALLBACK_URL",
  "PAYSTACK_MODE",
  "RESEND_LEARNING_SEGMENT_ID",
  "SUPPORT_FROM_EMAIL",
];

const productionTextBindings = Object.fromEntries(
  productionTextBindingNames
    .filter((name) => typeof process.env[name] === "string")
    .map((name) => [name, bindings.text(process.env[name]!)]),
);

export default defineConfig({
  worker: defineWorker({
    name: "growvelt-learning-production",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: true,
    previewUrls: false,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ...productionTextBindings,
      LEARNING_FORWARDING_TOKEN: bindings.secret(),
      PAYSTACK_LIVE_SECRET_KEY: bindings.secret(),
      RESEND_API_KEY: bindings.secret(),
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
      TURNSTILE_SECRET_KEY: bindings.secret(),
    },
  }),
});
