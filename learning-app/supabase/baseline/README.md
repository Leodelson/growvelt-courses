# Growvelt Learning remote database baseline

This directory documents the production schema captured during Phase 0A on
2026-08-20 from Supabase project `qtcpjcaoptdunuefwvgc`.

The canonical machine-readable baseline is the declarative schema tree in
`../schemas/`. It was produced with Supabase CLI 2.115.0 using:

```text
supabase db pull --declarative --linked --schema public,storage --strict-coverage
```

The command read database metadata only. It did not export production rows,
write migration history, or execute SQL against production.

## Safety boundary

- The baseline is deliberately outside `supabase/migrations`.
- `supabase/config.toml` keeps `db.migrations.schema_paths = []`.
- Do not run this baseline against the linked production project.
- Do not copy the baseline into `migrations` and run `db push`.
- Future approved database changes must be new, forward-only migrations.
- Before future schema work, diff against this baseline and verify the target.

Supabase's declarative exporter excludes managed `storage` tables and their
policies. Bucket settings were inspected through the read-only Storage API and
the deployed `storage.objects` policies were captured separately in
`storage-security.snapshot.sql`.

No production user data, course content, email addresses, certificates,
storage objects, tokens, database passwords, or API keys are included.
