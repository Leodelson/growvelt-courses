# Dual-host payment returns

The www migration retains learn.growvelt.com for in-flight Auth and Paystack callbacks. Browser sessions remain host-local; no cookies, users, keys or databases are shared with Careers.

When the reviewed www cutover configuration is active, new course, company and subscription checkouts select the callback origin from the same-origin-validated request URL. Only https://learn.growvelt.com and https://www.growvelt.com are accepted. The configured callback must still be the approved /payments/paystack/callback endpoint; query parameters and transaction references remain intact. Client body and forwarded-host headers do not choose the return URL. Invalid configuration fails before checkout reservation/provider initialization. With cutover disabled, the existing configured callback behavior is unchanged, including local/Preview workflows.

Previously initialized Paystack authorization URLs are not rewritten or recreated. A resumed older checkout may still return to its original host and require sign-in there. Reconciliation must reuse the original reference, never charge again to resolve a hostname change.

Validation: scripts/test-learning-payment-return-host.mjs exercises all three initializer paths on both hosts, hostile origins/body/headers, early denial without database/provider calls, dormant behavior and existing subscription authorization reuse. These tests use synthetic clients and never access hosted data. Also run the domain-transition, Auth-session and subscription contract/management regressions, TypeScript and credential-disabled optimized HTTP rehearsals.

At cutover retain all existing Supabase redirects, add narrowly scoped www and learn callback-query entries, permit www on the existing Learning Turnstile widget, and preserve CAPTCHA hostname validation. Update saved hosted email logo/footer URLs to SiteURL while preserving every authentication variable. Keep the learn payment/webhook endpoints and payment mode/keys unchanged. No migrations, resets or cron changes are needed.

Rollback: restore reviewed bridge deployment 5mzwwF1ufc6WVbFoqkQY1VDupNQh, restore the legacy Learning origin/cutover flags and Supabase Site URL, retain additive redirects, and independently verify the existing enabled daily cron at /api/internal/commercial/release-matured (0 4 * * * UTC). Do not use the older bridge-OFF deployment while www remains attached. Never reset data or reverse payments as part of hostname rollback.
