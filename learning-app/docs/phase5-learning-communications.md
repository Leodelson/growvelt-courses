# Phase 5 — Learning communications (local preparation)

Careers supplied a read-only implementation map for its sign-in alert, Email Center, and Help Assistant. Learning uses separate routes, tables, Supabase Auth, consent records, and provider configuration. No Careers code or hosted settings were changed.

## Implemented locally

- Fresh Learning password and OAuth sign-ins create a deduplicated sign-in record and an in-app notification. Settings displays recent browser/device/country (when the hosting platform supplies a country code); no full IP address is stored. The notification bell lists and marks Learning receipts read. Failed activity recording never blocks sign-in.
- Admin Email Center can save and preview plain-text campaign drafts, count opted-in learner/instructor/organization audiences, and explicitly send at most three recipients per confirmed request. Marketing consent defaults **off**. Organization audience means active company-workspace owners/admins. A unique recipient claim and provider idempotency key prevent silent duplicate retries. Provider acceptance is recorded separately from actual delivery. Unsubscribe requires a POST confirmation from the email link; transactional notices remain separate.
- A Learning Help Assistant offers topic-based guidance and sends unresolved/account-specific questions to Learning support. It is a guide, **not** an AI model or an instant staffed live chat. It never requests passwords or payment details.
- A Learning-only human support case flow is now prepared locally: signed-in users submit and follow requests; admins have a separate inbox, can reply and resolve cases; admin replies create an in-app notification. RLS and server-side functions scope cases to their Learning owner/admin. This first version is text-only; attachments, external reply email, SLAs, export, and retention automation are not included.

## Release gate

1. Careers' read-only handoff has been reviewed for flows and security pitfalls. It does not include exact visual styling specifications; keep Learning's own visual system and do a separate visual review before release. The data and support flows remain Learning-only. Automated browser review could not run in this session because local browser use is disabled in Work settings; do not treat the visual review as approved.
2. **Applied 20 October 2026** to the verified Learning project (`qtcpjcaoptdunuefwvgc`) through its signed-in Supabase SQL Editor after confirming that only these versions were pending: `20261103000000_add_learning_login_activity_and_notifications.sql`, `20261104000000_add_learning_email_center.sql`, and `20261105000000_add_learning_support_inbox.sql`. The follow-up check found all three history records, all seven tables with RLS enabled, all five expected functions, and marketing consent defaulting off. Careers was not touched.
3. Verify the existing `RESEND_API_KEY` is Learning-authorized and the sender is verified. Do not create a new provider subscription or change Paystack, Supabase Auth, or domain settings.
4. Smoke-test password and Google sign-in on `www.growvelt.com` and `learn.growvelt.com`; check Settings history, bell read state, opt-in default/off/on, audience counts, draft preview, unsubscribe, admin-only access, and provider error handling. Use a controlled opt-in test account before any wider campaign.
5. Do not mark Phase 5 complete or begin Phase 6 hardening until the user approves the visual result and the production smoke tests pass.

## Local checks — 20 October 2026

- `node scripts/test-learning-communications-db.cjs` passed. It exercises all three communications migrations, opt-in audience rules, support ownership/admin boundaries, admin replies, notifications, and resolve/reopen transitions using local PGlite.
- `npx tsc --noEmit --incremental false` passed.
- Targeted ESLint passed with zero errors and three `<img>` optimization warnings in `app/components/learning-shell-navigation.tsx`.
- `npm run build` passed, including generation of the communications routes.
- The three hosted migrations above were applied and verified. No provider, authenticated application, email-delivery, or browser smoke checks were run, and no deployment was made.

## Deferred, not silently assumed complete

- Support attachment upload and retention automation.
- Login-alert email and a formal sign-in-history retention job.
- Email provider delivery/bounce webhooks and a controlled broadcast operations runbook.
- Multi-language Help Assistant copy and visual QA on real mobile devices.
