# Learning instructor Live payout operator runbook

This runbook covers instructor Live payout batches in Growvelt Learning. It
does not authorize a transfer or enable a production gate. Do not use a real
transfer as a test.

## Current release state

- Production branch: `codex/learning-production-git-release`.
- The payout batch UI is deployed in Learning production. The owner confirmed
  the UI check.
- `LEARNING_LIVE_PAYOUT_PROFILE_SETUP_ENABLED` and
  `LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED` are enabled.
- `LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED`,
  `LEARNING_LIVE_PAYOUT_BATCH_OTP_ENABLED`, and
  `LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED` are absent/disabled.
- `PAYSTACK_LIVE_SECRET_KEY` is a server-only binding; never print, copy into
  logs, or add it to Git.
- The migration files for payout profile, eligibility, batch identity,
  approval, submission, reconciliation, and list views are on the production
  branch. Verify the hosted migration ledger before changing any payout gate.
- No instructor transfer has been sent by this review.

Refunds are separate from payout batches. The current Worker has
`PAYMENTS_REFUNDS_ENABLED=true` and `PAYMENTS_LIVE_REFUNDS_ENABLED=true`, while
the payment activation runbooks say to keep Live refund initiation disabled
unless separately approved. Do not use these refund settings as a payout
switch. Resolve that policy mismatch before considering Phase 2 fully signed
off. No refund has been submitted by this review.

## Preconditions before enabling a transfer

1. Confirm the selected Cloudflare Worker is `growvelt-learning-production`
   and the selected Paystack integration is Growvelt Learning Live.
2. Confirm the payout migration ledger is current and there are no migration
   mismatches. Do not manually edit production financial rows.
3. Confirm Paystack Live transfers and OTP delivery are enabled for the correct
   merchant. Confirm an authorized operator can receive and securely enter the
   provider OTP.
4. Review open payout batches and findings. Resolve existing `pending`,
   `recovery_required`, and `needs_attention` attempts before approving more
   batches.
5. Independently confirm payee names, bank details, eligible earnings,
   currency, batch total, fees, and available merchant balance.
6. Obtain separate approval to enable Live transfer submission. Approval alone
   reserves earnings and does not send money.

The application accepts NGN batches of at least ₦1,000 and at most 100 earning
items for one instructor and one verified payout profile. Its read-only balance
preflight requires the payout total plus a ₦100 allowance. This check does not
replace the operator's review of provider fees or merchant availability.

## Normal operator flow

1. Open `/dashboard/admin/commercial` as an active Learning administrator.
2. Review the candidate earnings and verified payout profile. Create a batch
   only for one instructor/profile, confirm the exact total, and approve it
   once. Approval reserves the included earnings; it does not call Paystack.
3. Only during an approved payout window, enable
   `LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED` and submit the reviewed batch
   once by typing its displayed `LPB-…` reference. The server checks the Live
   balance before creating the immutable attempt and initiating the provider
   transfer.
4. If Paystack returns an OTP challenge, enable
   `LEARNING_LIVE_PAYOUT_BATCH_OTP_ENABLED` for the authorized operator and
   enter the provider's six-digit code once for that attempt. Never retry an
   OTP after an uncertain response.
5. Keep signed webhook processing available. Keep
   `LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED` enabled while a transfer
   may be in flight. Use **Verify provider status** only to reconcile the
   exact stored reference against Paystack's Live API evidence.
6. Confirm the final batch status and audit history. A transfer is complete
   only after authoritative provider evidence is processed and the financial
   ledger reflects the same amount. Provider acceptance or `pending` is not
   completion.

## Uncertain, failed, or reversed attempts

- If a request times out, the receipt cannot be stored, an OTP response is
  unclear, or the UI reports verification is required, do not submit again.
  Preserve the attempt reference and use provider verification/reconciliation
  after checking Paystack.
- A provider status or identity mismatch, duplicate conflict, or unresolved
  finding is a stop condition. Do not approve a replacement batch or edit the
  database by hand. Escalate to the Learning payout operator and Paystack.
- Only after provider evidence confirms a terminal failed or reversed outcome
  and the batch is reconciled may an administrator review a new payout action.
- If a transfer went to the wrong account, contact Paystack immediately. The
  application cannot reverse an external bank transfer by rolling back code.
- Retain batch, attempt, event, and audit records. Reconciliation is
  forward-only; do not delete receipts or reset an attempt to make it retry.

## Pause and rollback

To pause new payouts, set
`LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED=false`,
`LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED=false`, and
`LEARNING_LIVE_PAYOUT_BATCH_OTP_ENABLED=false`. Keep signed webhook processing
and provider reconciliation available for any existing attempts until each is
resolved. Do not disable recovery as a way to make a pending transfer appear
complete. After the open-attempt list and findings are clear, recovery can be
disabled as part of closing the approved window.

If the Worker code itself must be rolled back, restore the last verified
Learning production Worker version through Cloudflare. Keep the additive
financial migrations, provider receipts, audit events, and ledger history;
restore behavior with forward fixes rather than deleting or resetting records.

## Offline verification record

The following existing checks passed without Paystack or production network
calls:

- payout profile migration and UI/application boundaries;
- batch eligibility and identity constraints;
- atomic batch approval and earning reservation;
- submission, OTP, and idempotency state handling;
- provider-event reconciliation and batch settlement; and
- mocked Live transfer provider contracts.

These checks prove application behavior against isolated fixtures. They do not
prove a real transfer, merchant OTP delivery, or the latest hosted migration
ledger. No real transfer or refund was used as a test.
