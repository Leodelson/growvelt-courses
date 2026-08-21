# Growvelt Learning database migration workflow

The declarative Phase 0A tree in `supabase/schemas` is a remote reference
baseline. It is **not a migration** and must never be reapplied to production.

## Forward-only workflow

1. Confirm the linked target with `supabase projects list` and inspect Git
   status.
2. Create a timestamped file with `supabase migration new <name>`.
3. Write the smallest forward-only SQL change. Do not copy baseline SQL.
4. Review for destructive statements, data writes, secrets, unsafe grants and
   missing object qualification.
5. Validate on an isolated local/staging project when available. Never run
   `db reset` against production or while configuration could target it.
6. Review pending migrations with `supabase migration list --linked` and a
   non-mutating/dry-run mechanism that does not expose credentials.
7. Apply an approved migration with the normal linked migration deployment
   process; do not improvise the same change in Dashboard SQL.
8. Verify migration history, catalog state, RLS/grants, application regression
   checks and production logs.
9. Pull/diff declarative metadata after deployment to detect drift and update
   the reference baseline only through an explicitly approved baseline refresh.

## Rollback strategy

Production migrations are forward-only. Prefer a reviewed forward-fix that
restores the prior grants/function/policy definition. Each migration must state
its inverse before deployment. Never use a destructive reset as rollback.

Manual Dashboard changes should be exceptional. If an emergency requires one,
capture the exact change immediately in a forward migration and reconcile the
declarative snapshot afterward.
