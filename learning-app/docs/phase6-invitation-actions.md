# Phase Six invitation action checks

## Changes

Team invitation accept, decline and cancel now reject non-positive IDs before
database access. Team member removal also requires a positive workspace ID and
a correctly grouped UUID. No permission grants or database functions changed.

The regression suite now covers seven existing actions across team and instructor
organizations: accept, decline, cancel and team member removal. It verifies
same-origin rejection, signed-out denial, database permission errors, rejection
of malformed IDs before backend access, and exact RPC parameters. Request-body
IDs, roles and response values cannot override path parameters or the fixed
action. Instructor acceptance notification context remains scoped to the verified
invitee. Mock tests send no real invitations or emails.

## Release checks

- Actual-handler API boundary fixtures passed.
- Scoped ESLint and full TypeScript check passed.
- Organization exit-control tests passed on the isolated local Supabase database.
- Instructor invitation and team workspace foundation tests passed on that same
  isolated local database.

The preceding release completed a full production build; this validation-only
route change was checked with TypeScript and actual-handler fixtures. Production
deployment readiness still needs independent confirmation after push. Hosted
Supabase and all live-payment switches remain untouched.
