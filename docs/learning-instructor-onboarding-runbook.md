# Growvelt Learning Instructor onboarding fields

## Scope

`202608090006_instructor_application_onboarding_fields.sql` expands the existing `public.instructor_profiles` application record with applicant-safe vetting information:

- country (required for new submissions);
- optional phone;
- years of professional experience;
- teaching experience;
- motivation to teach;
- optional public portfolio or professional URL.

It does not change the `pending` / `approved` / `rejected` lifecycle, grant an Instructor capability, create payment or payout data, or create notification automation.

## Security model

- Applicant identity remains `auth.uid()` matched to `instructor_profiles.user_id`.
- Full name is sourced from `public.profiles`; current account email is sourced from the matching `auth.users` identity inside Admin-only reader RPCs. Neither is a retyped application identity field.
- New browser submissions must include a non-empty country, while existing applications remain readable in their current state.
- Browser users gain column grants only for the six new applicant fields plus the established safe application fields, and only while pending under RLS.
- `approval_status`, review metadata, and `account_capabilities` remain outside browser mutation access.
- Admin readers join `public.profiles` for the display name and `auth.users` only for the current account email, inside the existing Admin-authorized `SECURITY DEFINER` RPCs. No public/profile/Auth-table read access is broadened.

## Review before execution

1. Confirm migrations `202608090001` through `202608090005` are applied successfully.
2. Read the guards in `202608090006_instructor_application_onboarding_fields.sql`; do not alter them to bypass unexpected production state.
3. Apply the migration in one approved Supabase migration execution. It is atomic.
4. Deploy the matching Learning source only after the migration succeeds, because the new UI selects the added fields.

## Verification queries

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'instructor_profiles'
  and column_name in (
    'country', 'phone', 'years_experience', 'teaching_experience', 'motivation', 'portfolio_url'
  )
order by column_name;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.instructor_profiles'::regclass
  and conname like 'instructor_profiles_%_check'
order by conname;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'instructor_profiles'
  and grantee = 'authenticated'
  and column_name in (
    'country', 'phone', 'years_experience', 'teaching_experience', 'motivation', 'portfolio_url',
    'approval_status', 'reviewed_at', 'reviewed_by', 'review_note'
  )
order by column_name, privilege_type;

select routine_name, specific_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'list_pending_instructor_applications',
    'get_instructor_application_for_review',
    'review_instructor_application'
  )
order by routine_name, specific_name;
```

## Functional checks

- A new authenticated applicant can submit all required fields with a country.
- Attempting to omit country is rejected by the form and by the owner INSERT policy.
- A browser applicant cannot set `approval_status`, `reviewed_at`, `reviewed_by`, `review_note`, or a capability.
- An Admin can see account name/email and the expanded application fields through the Admin queue/detail RPCs.
- A rejected applicant still sees only their status, not the internal review note.
- Approve/reject remains the existing atomic review RPC; the new dialog changes only confirmation UX.

## Corrective guidance

Do not restore broad `SELECT` or mutation grants on `instructor_profiles` if a legacy page fails. Do not use a browser client to update review fields or capabilities. If the migration guard fails, stop and inspect the existing schema/function/grant state before creating a forward correction.
