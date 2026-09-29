# Phase 3C3 Paystack Test checkout

Phase 3C3 connects company paid-course purchases to Paystack Test Mode. The
current production learning site runs this checkout in Test Mode for controlled
verification; it does not collect real money. A switch to Live Mode still
requires a separate cutover review and explicit configuration.

## Test Mode configuration

For the environment approved for testing, use:

```text
PAYSTACK_MODE=test
PAYSTACK_TEST_SECRET_KEY=sk_test_...
PAYMENTS_CHECKOUT_ENABLED=true
PAYMENTS_REFUNDS_ENABLED=false
PAYSTACK_CALLBACK_URL=https://<test-host>/payments/paystack/callback
```

Do not use a live secret in Test Mode. The test secret must remain server-only.
The Paystack Test webhook should point to:

```text
https://<test-host>/api/payments/paystack/webhook
```

The target Supabase database must have the Phase 3C1 through 3C3 migrations
before company checkout is enabled. Confirm the exact linked project and apply
migrations through the repository's migration workflow.

## Browser test checklist

### Learner test checkout

1. In the Test Mode environment, sign in with the disposable learner assigned to the active
   Paystack test fixture.
2. Open the fixture course and confirm the button says `Buy course · Test mode`.
3. Start checkout and complete Paystack's test payment using a Paystack test
   payment method.
4. Confirm the callback page is informational, then refresh **My Learning**.
5. Confirm access appears only after the signed Test webhook is received.

### Company test checkout

1. In the Test Mode environment, sign in as an active company owner or admin.
2. Open **Company learning** and select a published paid course supplied by an
   instructor/provider organization.
3. Select one or more active employees and choose **Continue to secure test
   checkout**.
4. Complete the Paystack Test payment.
5. Confirm the purchase changes to paid and each selected employee receives the
   course in My Learning. Do not pay again if the return page is still checking;
   refresh the callback or use its check-again action.
6. Open the company report and confirm the assignment/progress row is visible.
7. Open Company learning → Company purchase history and verify the course total,
   seat count, status, and Paystack reference. This is not a tax invoice or a
   statement of Paystack's final charged amount including any provider fees.

### Safety and retry cases

- Close or cancel checkout and confirm no employee access is granted.
- Retry a failed initialization and confirm the purchase can be prepared again.
- Re-deliver the same signed webhook and confirm no duplicate enrollment or
  assignment is created.
- Confirm a non-manager cannot prepare or start a company checkout.
- Confirm Live Mode has not been enabled unintentionally.

## Live cutover later

After Paystack approves Live Mode, configure Production separately with
`PAYSTACK_MODE=live`, `PAYSTACK_LIVE_SECRET_KEY`, the exact production callback,
and a separately approved checkout enablement window. Do not reuse the Preview
test secret or enable both modes in one environment.
