# Phase 1A controlled paid-course fixture

This control permits one temporary Paystack test-mode course to be exercised by one disposable learner without enabling general paid-course publishing.

## Invariants

- The normal instructor submission function still rejects paid courses.
- Only a service-role operator call can activate or close a fixture.
- The operator must be an active Growvelt Learning administrator.
- The course must be a complete paid NGN draft with a `[TEST] ` title and `phase1a-paystack-test-...` slug.
- The learner must exist and have no active admin or instructor capability.
- Only one active fixture can exist, and its lifetime is 15 minutes to 24 hours.
- A fixture course is excluded from public and authenticated catalogs, direct public table policies, and preview policies forever.
- During the active window, only the designated authenticated learner can resolve the course-detail RPC.
- Checkout UI and API initialization both check the authenticated learner's fixture eligibility. The order RPC independently enforces it again.
- Activation and closure append explicit `learning_audit_events`. Closure archives the course but preserves financial history and any resulting entitlement/enrollment.
- Each renewed testing window is a new immutable fixture row linked to its immediate predecessor; the original activation and expiry timestamps are never rewritten.
- Renewal inherits the same course and tester, records expiry/renewal/activation audit events, and is rejected after any order, attempt, provider event, ledger record, entitlement, or enrollment exists for that pair.

## Operator workflow

1. Create a disposable learner account and record its profile UUID.
2. As an approved instructor, create one paid draft titled `[TEST] ...` with a slug beginning `phase1a-paystack-test-`; complete its curriculum.
3. Choose an active admin UUID and an expiry no more than 24 hours ahead.
4. Keep `PAYSTACK_MODE=test` and checkout disabled until founder approval.
5. Use `scripts/manage-phase1a-test-fixture.mjs activate` only with the explicit target and confirmation variables.
6. Run the controlled end-to-end test only after checkout is separately enabled.
7. Close the fixture immediately afterward with the same script's `close` action.
8. Reconcile orders, attempts, provider events, ledger entries, entitlements, enrollments, and audit events before deleting the disposable auth account.

## Renewing an unused expired window

Renewal is available only when the previous window is expired or properly closed and the learner/course pair has no financial or access history. The guarded function automatically records an expired-but-stored-active predecessor as closed, preserves its timestamps, and creates a linked successor for the same course and learner. It does not accept replacement course or learner identifiers.

Use `scripts/manage-phase1a-test-fixture.mjs renew` with:

- `PHASE1A_FIXTURE_CONFIRMATION=RENEW_PHASE1A_TEST_FIXTURE`
- `PHASE1A_FIXTURE_PREVIOUS_ID`
- `PHASE1A_FIXTURE_OPERATOR_ID`
- `PHASE1A_FIXTURE_EXPIRES_AT` between 15 minutes and 24 hours ahead
- the existing guarded target and server-only Supabase environment variables

Only one successor may reference a historical fixture, and the global one-active-fixture index remains in force. After any successful or attempted financial flow creates history, close the fixture instead of renewing it.

The script never embeds or prints credentials. It refuses a remote target other than the Growvelt Learning project and requires an exact confirmation phrase.
