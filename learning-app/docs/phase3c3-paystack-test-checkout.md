# Phase 3C3 Preview Paystack Test checkout

Phase 3C3 connects company paid-course purchases to Paystack Test Mode. It is
intentionally a Preview/staging feature. Production remains disabled until the
Paystack Live approval and cutover review are complete.

## Preview-only Vercel configuration

Set these variables in the Vercel **Preview** environment only:

```text
PAYSTACK_MODE=test
PAYSTACK_TEST_SECRET_KEY=sk_test_...
PAYMENTS_CHECKOUT_ENABLED=true
PAYMENTS_REFUNDS_ENABLED=false
PAYSTACK_CALLBACK_URL=https://<preview-host>/payments/paystack/callback
```

Do not add the live secret to Preview, and do not turn on `PAYMENTS_CHECKOUT_ENABLED`
in Production. The test secret must remain server-only. The Paystack Test webhook
should point to:

```text
https://<preview-host>/api/payments/paystack/webhook
```

The Preview Supabase database must have the Phase 3C1 and 3C2 migrations before
the company checkout route is enabled. Apply them through the repository's normal
linked-target migration workflow; never paste them into an ad-hoc dashboard SQL
editor.

## Browser test checklist

### Learner test checkout

1. In Preview, sign in with the disposable learner assigned to the active
   Paystack test fixture.
2. Open the fixture course and confirm the button says `Buy course · Test mode`.
3. Start checkout and complete Paystack's test payment using a Paystack test
   payment method.
4. Confirm the callback page is informational, then refresh **My Learning**.
5. Confirm access appears only after the signed Test webhook is received.

### Company test checkout

1. In Preview, sign in as an active company owner or admin.
2. Open **Company learning** and select a published paid course supplied by an
   instructor/provider organization.
3. Select one or more active employees and choose **Continue to secure test
   checkout**.
4. Complete the Paystack Test payment.
5. Confirm the purchase changes to paid and each selected employee receives the
   course in their company learning area.
6. Open the company report and confirm the assignment/progress row is visible.

### Safety and retry cases

- Close or cancel checkout and confirm no employee access is granted.
- Retry a failed initialization and confirm the purchase can be prepared again.
- Re-deliver the same signed webhook and confirm no duplicate enrollment or
  assignment is created.
- Confirm a non-manager cannot prepare or start a company checkout.
- Confirm Production still shows paid checkout as unavailable.

## Live cutover later

After Paystack approves Live Mode, configure Production separately with
`PAYSTACK_MODE=live`, `PAYSTACK_LIVE_SECRET_KEY`, the exact production callback,
and a separately approved checkout enablement window. Do not reuse the Preview
test secret or enable both modes in one environment.
