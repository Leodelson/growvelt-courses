# Phase 1B3A controlled Paystack Live activation runbook

This is a preparation runbook. It does not authorize Live Mode, a live credential, checkout, refunds, or a transaction.

## Required configuration when founder approval and Paystack verification are complete

Configure **only Growvelt Learning Production** in Vercel. Keep Growvelt Jobs separate.

| Variable | Required value | Notes |
| --- | --- | --- |
| `PAYSTACK_MODE` | `live` | Must change only in the approved cutover window. |
| `PAYSTACK_LIVE_SECRET_KEY` | Growvelt Learning `sk_live_...` | Server-only Vercel secret. Never place in Git, browser code, logs, or Preview/Development. |
| `PAYSTACK_CALLBACK_URL` | `https://learn.growvelt.com/payments/paystack/callback` | HTTPS and exact host/path are validated. |
| `PAYMENTS_CHECKOUT_ENABLED` | `false` initially | Independent checkout kill switch. |
| `PAYMENTS_REFUNDS_ENABLED` | `false` initially | Independent refund kill switch. |

Remove `PAYSTACK_SECRET_KEY` and `PAYSTACK_TEST_SECRET_KEY` from the Production environment before setting Live Mode. Test credentials remain only in local/test-specific environments. A Paystack public key is not needed for the server-initialized hosted redirect architecture.

In the Growvelt Learning **Live** Paystack integration, configure:

- Webhook URL: `https://learn.growvelt.com/api/payments/paystack/webhook`
- Callback URL: `https://learn.growvelt.com/payments/paystack/callback`

The webhook continues to validate the raw body using `x-paystack-signature` HMAC-SHA512 before accepting an event. Browser callbacks remain status-only; they never grant access. Paystack's API uses the same HTTPS base URL in both environments, while the selected secret key determines the environment. See [Paystack API documentation](https://paystack.com/docs/api/) and [webhook documentation](https://paystack.com/docs/payments/webhooks/).

## Non-transactional preflight

1. Confirm Paystack business verification and the Growvelt Learning Live integration—not Growvelt Jobs—is selected.
2. Confirm the Live webhook and callback URLs above in Paystack; do not change the Test integration.
3. Add the Live secret only to Vercel Production. Remove Production test-secret variables before selecting `live`.
4. Keep both kill switches `false`, deploy, and confirm the configuration test passes without printing any secret.
5. Confirm `POST /api/payments/paystack/initialize` returns `checkout_disabled` and refund initiation returns `refunds_disabled`.
6. Confirm the signed webhook endpoint is publicly reachable and invalid signatures are rejected. Do not send a fabricated event.
7. Deploy the separately reviewed forward-only database migration that permits verified provider domain `live`; this migration is intentionally **not** part of Phase 1B3A.

## First approved low-value live transaction

Only after a founder authorizes the cutover:

1. Reconfirm clean reconciliation, active administrator access, policy pages, support coverage, and the rollback owner.
2. Enable checkout only for the approved controlled scope; leave refunds disabled.
3. Have the approved learner complete one low-value payment once.
4. Disable checkout immediately after initialization.
5. Verify one signed provider event, one paid order, one succeeded attempt, one capture transaction with two balanced entries, one entitlement, one enrollment, and zero reconciliation issues.
6. Confirm the callback is informational only and My Learning access follows verified finalization.

## Immediate rollback

If any assertion fails, set `PAYMENTS_CHECKOUT_ENABLED=false`, redeploy, and leave the webhook reachable for already-created transactions. Do not edit financial rows manually. Use the existing administrator verification/recovery path only after provider verification, then record the incident and reconcile. Keep `PAYMENTS_REFUNDS_ENABLED=false` unless a separately approved refund action is required.
