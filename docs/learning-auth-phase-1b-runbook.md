# Growvelt Learning Phase 1B authentication runbook

## Scope

This checkpoint adds email/password and Google Sign-In to `learn.growvelt.com` using Supabase SSR PKCE. It does not add course, payment, entitlement, capability, Storage, Realtime, or Admin functionality.

## Prerequisites

1. Review `202608090002_learning_profile_creation.sql`; it has **not** been executed.
2. In Vercel, configure only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Learning project. Never configure a service-role key or Google client secret there.
3. In Supabase Auth URL Configuration, retain the existing Courses URLs and add the approved Learning callback URLs: `https://learn.growvelt.com/auth/callback`, `http://localhost:3000/auth/callback`, and `http://localhost:3001/auth/callback`.
4. Set the Auth Site URL to `https://learn.growvelt.com` only after confirming existing Courses flows always provide their explicit redirect URLs.
5. Keep the existing Google provider, client ID/secret, nonce-check setting, and email requirement unchanged. Google Cloud continues to use the Supabase-project callback URI shown by the provider configuration.

## Migration execution

Run the reviewed migration once through the Supabase SQL editor in a controlled maintenance window. It is atomic and guarded. Do not edit it to bypass a guard.

Verify after execution:

```sql
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_growvelt_learning_auth_user_created';
select routine_name from information_schema.routines where routine_schema = 'public' and routine_name = 'handle_new_growvelt_learning_profile';
```

Create one test user only after redirect URLs and email delivery are ready. Verify its `profiles` row has the same UUID, trusted email, and `account_type = 'learner'`; verify no `account_capabilities` row exists.

## Admin bootstrap

After the legitimate administrator has created and confirmed their own account, identify and manually verify its Auth UUID. Use the existing authorization-hardening runbook’s owner/service-role capability-insert procedure to grant active `admin`. Never update `profiles.account_type`, use a Google domain, or add an application-side allowlist.

## Launch blockers

- Configure custom SMTP before broad public launch. The built-in Supabase sender is not production email infrastructure.
- Enable and test Supabase CAPTCHA (prefer Turnstile) before broad public signup. The application is intentionally prepared to add `captchaToken`, but CAPTCHA is not enabled in this checkpoint.
- Test email confirmation, password recovery, Google OAuth, expired callbacks, sign-out, protected routes, and redirects in production and local environments.

## Corrective guidance

If an auth flow breaks, correct the application configuration or introduce a forward-only migration. Do not drop the trigger, restore browser profile upserts, make `account_type` authoritative, or grant capabilities from signup metadata as a rollback shortcut.
