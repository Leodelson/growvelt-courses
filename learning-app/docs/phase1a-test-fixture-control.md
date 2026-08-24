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

## Operator workflow

1. Create a disposable learner account and record its profile UUID.
2. As an approved instructor, create one paid draft titled `[TEST] ...` with a slug beginning `phase1a-paystack-test-`; complete its curriculum.
3. Choose an active admin UUID and an expiry no more than 24 hours ahead.
4. Keep `PAYSTACK_MODE=test` and checkout disabled until founder approval.
5. Use `scripts/manage-phase1a-test-fixture.mjs activate` only with the explicit target and confirmation variables.
6. Run the controlled end-to-end test only after checkout is separately enabled.
7. Close the fixture immediately afterward with the same script's `close` action.
8. Reconcile orders, attempts, provider events, ledger entries, entitlements, enrollments, and audit events before deleting the disposable auth account.

The script never embeds or prints credentials. It refuses a remote target other than the Growvelt Learning project and requires an exact confirmation phrase.
