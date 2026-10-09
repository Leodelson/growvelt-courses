# Phase 4: promotions and coupon foundation

Status: the first coupon slice—private administration, atomic Test Mode reservations, and individual learner Test Mode checkout—is implemented locally behind `PAYMENTS_TEST_COUPONS_ENABLED`, which defaults to off. Calculator, privacy/admin, checkout/idempotency, concurrency, full-schema migration rollback, existing seller-earnings/refund/dispute regressions, and coupon-specific discounted refund/lost-dispute callback regressions pass against local test databases. Migrations `20261016000000` and `20261017000000` have been applied to the linked Growvelt Courses project. The application code has not yet been pushed or deployed and the feature flag remains off.

## Goal and safe first release

Add administrator-issued coupon codes for individual paid-course purchases. The first release is deliberately narrow: one code per learner checkout, one-time use per learner, no stacking, no company purchases, no subscriptions, no featured-placement charges, and no instructor-created codes. It must work in Paystack Test Mode before any Live checkout is considered.

The existing Company Test Mode-only course remains private and excluded from public learner checkout. Coupons must never make that course publicly discoverable or allow its purchase outside the company Test Mode path.

## Discount and seller accounting policy

- Initial coupons are funded from Growvelt's platform share. The instructor/provider's agreed seller share is not reduced by a promotion.
- To keep that promise affordable and balanced, the applied discount cannot exceed the platform commission available on that order. If it would, the coupon is rejected rather than silently reducing seller proceeds or creating a negative platform share.
- At order creation, store immutable snapshots of list price, coupon identity, discount amount, customer charge, seller share, and platform share after discount. The provider request and payment attempt must equal the customer charge; the ledger must still balance exactly.
- Initial checkout integration is limited to active Paystack Test Mode fixture courses and their assigned tester. Test-only fixture courses remain hidden from public discovery; Company Test Mode purchases remain on their separate path.
- The existing earnings model requires a positive instructor share for allocation, so a coupon is unavailable on courses whose current commercial terms yield no instructor proceeds.
- A retry reuses the same order snapshot. It cannot revalidate the code against different terms or change the charge after order creation.
- Refunds and disputes must reverse the actual captured amount and the corresponding recorded split. Coupon usage is not restored automatically after a paid order or refund; an administrator may issue a replacement code after review.

This is the least disruptive first policy because it preserves seller terms. It limits Growvelt's promotional cost to its existing commission. No promo may be activated until this split is represented and covered in the ledger and refund tests.

## Coupon rules for v1

- Normalize codes case-insensitively; accept only a short, human-readable ASCII alphabet and digits; never include or derive a code from customer data.
- Support a percentage discount and a fixed NGN discount, with an explicit maximum discount and non-zero minimum customer charge.
- Require an enabled flag, start/end timestamps, global redemption cap, per-user cap, and an allowlist of eligible course IDs. An empty course allowlist is not interpreted as “all courses.”
- A code is validated and reserved atomically with order creation. Concurrent requests cannot exceed its cap, and failed checkout releases only an unconsumed reservation after the existing recovery policy confirms the attempt is terminal.
- Do not expose code existence or remaining capacity to anonymous callers; return a generic invalid/unavailable response. This first integration additionally requires the signed-in owner of an active fixture. Any broader/public coupon validation—especially Live checkout—must add rate limiting before release.
- No stacking, transfer between accounts, retroactive application, or manual amount override.

## Required implementation sequence

1. **Complete locally:** add a pure integer-minor-unit calculator and table-driven tests for rounding, cap, zero/over-discount, invalid dates, course mismatch, redemption limits, seller-share preservation, and minimum charge. This step does not call Paystack or change the database.
2. **Complete locally:** add private coupon/redemption tables and admin/service-only RPCs. The database atomically enforces date windows, code status, course eligibility, global and per-user caps, the platform-share ceiling, an idempotent 15-minute reservation, and Test Mode-only reservation snapshots. Browser roles cannot read coupon budgets or redemption identities directly.
3. **Complete locally:** add an admin-only create/disable interface with immutable terms and an audit trail. No instructor self-service or company billing controls in v1.
4. **Implemented locally:** integrate the validated snapshot into individual learner Test Mode orders behind the default-off `PAYMENTS_TEST_COUPONS_ENABLED` flag. The order, attempt amount, reservation link, seller/platform split, terminal cancellation release, and successful-payment consumption are handled transactionally. Company checkout and Live checkout are unchanged.
5. **Complete locally:** full-schema DDL/rollback, isolated checkout retry, synthetic Test Mode callback idempotence, coupon consumption/cancellation, seller allocation, idempotent commercial-reversal ledger, calculator, coupon privacy/admin tests, and real PostgreSQL global/per-user capacity races pass. The actual discounted Test Mode full-refund and lost-dispute callback paths also pass, including charge-matched reversals, access revocation, consumed-code retention, exactly-once seller-earning reversal, and the existing seller-earnings/reconciliation suite. The tests use synthetic data and roll back; they do not apply migrations to a shared or remote database.

## Explicit exclusions and release gates

This work does not enable Live coupon checkout, initiate charges/transfers/refunds, change Paystack/Vercel keys, grant free access without a successful payment, alter seller terms, discount company seat purchases, or automatically deduct future seller earnings. The code path is guarded but not enabled, and coupon checkout is not deployed. The coupon slice still needs an explicitly controlled release/acceptance test before it can be closed. Featured paid placement, broader public campaigns, subscriptions, and enterprise contracts are separate later Phase 4 slices and have not started.

Phase 3C's real Live settlement, matching bank credit, and reviewed seller release/reservation remain open operational gates. They are not implied complete by this Test Mode promotion work, and no real-money purchase is authorized here.
