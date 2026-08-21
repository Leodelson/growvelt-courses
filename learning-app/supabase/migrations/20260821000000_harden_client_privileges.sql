-- Phase 0B: remove database-maintenance capabilities from browser roles and
-- prevent future public-schema objects from inheriting broad client grants.
--
-- Safety: privilege-only. This migration does not update/delete application
-- rows, recreate objects, alter RLS policies, or change application RPC logic.

do $migration$
declare
  table_record record;
begin
  for table_record in
    select format('%I.%I', schemaname, tablename) as qualified_name
    from pg_catalog.pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke maintain, references, trigger, truncate on table %s from anon, authenticated',
      table_record.qualified_name
    );
  end loop;
end
$migration$;

-- Legacy/public intake tables need submission access, not mutation or
-- maintenance authority. Existing RLS policies continue to constrain inserts.
revoke all on table public.course_contacts from anon, authenticated;
grant insert on table public.course_contacts to anon, authenticated;

revoke all on table public.course_leads from anon, authenticated;
grant insert on table public.course_leads to anon, authenticated;

revoke all on table public.course_registrations from anon, authenticated;
grant insert on table public.course_registrations to anon, authenticated;
grant select on table public.course_registrations to authenticated;

revoke all on table public.course_reviews from anon, authenticated;
grant select on table public.course_reviews to anon, authenticated;

revoke all on table public.partner_requests from anon, authenticated;
grant insert on table public.partner_requests to anon, authenticated;

revoke all on table public.newsletter_subscribers from anon, authenticated;
grant insert on table public.newsletter_subscribers to anon, authenticated;

-- Public lesson resources are read through their enrollment RLS policy.
revoke all on table public.lesson_resources from anon, authenticated;
grant select on table public.lesson_resources to anon, authenticated;

-- Event-trigger functions are invoked by PostgreSQL, never by browser roles.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to postgres, service_role;

-- Future objects must be explicitly granted only what their application path
-- requires. Existing service-role defaults remain unchanged.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
