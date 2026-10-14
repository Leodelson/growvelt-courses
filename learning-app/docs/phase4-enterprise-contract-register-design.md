# Phase 4 — Enterprise contract register (v1)

## Boundary

This slice is a private, Learning-Admin-only register of agreements already executed outside Growvelt and linked to an existing active company workspace. It records an external reference, term dates, a reference-only seat cap, and a short internal scope summary. It is append-only and auditable.

It does not generate or sign legal documents, upload agreements, collect payments, create invoices, alter company workspace seat limits, grant course access, initiate Paystack checkout, or release seller proceeds. A contract record is not proof of payment or a grant of service. The UI warns administrators not to enter personal, banking, card, or secret information.

## Security

- Database access is through narrowly scoped `SECURITY DEFINER` RPCs that each verify both an authenticated user and `is_growvelt_learning_admin()`.
- The table has RLS enabled and no direct privileges for `anon`, `authenticated`, or `service_role`.
- Update and delete attempts are rejected by an immutable-record trigger.
- Duplicate references are rejected case-insensitively within a workspace.
- Recording requires an explicit assertion that the agreement was already executed outside Growvelt; this assertion is not legal or payment verification.

## Verification boundary

`npm run test:phase4:enterprise-contract-register` checks the migration and UI/action authorization boundaries without connecting to a database. This migration has not been applied to the linked or hosted Supabase project. Before deploying the page, review the additive migration and apply it only to the verified Growvelt Courses project through the established migration workflow. Never reset the database or target Growvelt Auth/Careers.
