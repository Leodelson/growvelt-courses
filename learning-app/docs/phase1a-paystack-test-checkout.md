# Phase 1A Paystack test checkout

Phase 1A adds a test-only, hosted Paystack checkout path on top of the Phase 0E financial tables. It does not enable live payments, commissions, earnings, payouts, carts, subscriptions, or provider organizations.

## Safety gates

Checkout is available only when all of the following server environment settings are valid:

- `PAYSTACK_MODE=test`
- `PAYMENTS_CHECKOUT_ENABLED=true`
- `PAYSTACK_SECRET_KEY` is a Paystack test secret (`sk_test_...`)
- `PAYSTACK_CALLBACK_URL` is an HTTP(S) URL

The repository default is `PAYMENTS_CHECKOUT_ENABLED=false`. No public Paystack key or browser SDK is used. The secret key is server-only and must never be committed.

## Flow

1. The authenticated, same-origin initialization route accepts only a course ID.
2. The database loads the published course, rejects free/ineligible/already-owned courses, converts its NGN price to kobo, and snapshots the learner/course/provider/price into a new order and payment attempt.
3. The server initializes hosted Paystack checkout and returns only a validated `https://checkout.paystack.com` URL.
4. The callback page is status-only. A browser redirect never marks an order paid.
5. The webhook verifies the HMAC-SHA512 signature over the raw request body and accepts only `charge.success` events from Paystack's test domain in NGN.
6. One database transaction records the idempotent provider event, verifies reference/amount/currency, marks the attempt/order paid, writes a balanced capture ledger, and creates one enrollment and entitlement.

## Endpoints

- `POST /api/payments/paystack/initialize`
- `POST /api/payments/paystack/webhook`
- `GET /payments/paystack/callback?reference=GL-...`

For a local hosted-checkout test, expose localhost with an approved temporary HTTPS tunnel and configure Paystack's **Test Webhook URL** to `<tunnel>/api/payments/paystack/webhook`. The test callback may remain the configured callback URL sent during initialization. Never point a test webhook at Growvelt Jobs.

## Reconciliation

`reconcile_paystack_test_learning_payments()` is service-role/postgres only. It reports inconsistent paid orders, missing captures/enrollments/entitlements, and failed or unprocessed provider events. It does not repair or mutate records automatically.

## Deployment order (not performed in local Phase 1A)

1. Review and locally test the forward migration.
2. Deploy the migration alone and validate its objects.
3. Deploy application code with checkout still disabled.
4. Configure the Learning Paystack **test** webhook only.
5. Enable test checkout only in an explicitly approved test environment.
6. Run one disposable test purchase and reconciliation check.

Live-money activation requires a separate founder approval and operational/legal readiness review.
