-- Read-only post-deployment assertions for Phase 0B.
-- Safe to run against the linked database: no application rows are mutated.

do $assertions$
declare
  dangerous_grant_count integer;
  broad_default_grant_count integer;
  rls_table_count integer;
begin
  select count(*)
    into dangerous_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN');

  if dangerous_grant_count <> 0 then
    raise exception 'Phase 0B: % dangerous browser-role grants remain', dangerous_grant_count;
  end if;

  select count(*)
    into broad_default_grant_count
  from pg_catalog.pg_default_acl as defaults
  join pg_catalog.pg_namespace as namespace on namespace.oid = defaults.defaclnamespace
  cross join lateral pg_catalog.aclexplode(defaults.defaclacl) as privilege
  join pg_catalog.pg_roles as grantee on grantee.oid = privilege.grantee
  join pg_catalog.pg_roles as owner_role on owner_role.oid = defaults.defaclrole
  where namespace.nspname = 'public'
    and owner_role.rolname = 'postgres'
    and grantee.rolname in ('anon', 'authenticated');

  if broad_default_grant_count <> 0 then
    raise exception 'Phase 0B: % browser-role default grants remain', broad_default_grant_count;
  end if;

  if has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'Phase 0B: a browser role can execute rls_auto_enable';
  end if;

  select count(*)
    into rls_table_count
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if rls_table_count <> 26 then
    raise exception 'Phase 0D: expected 26 RLS-enabled public tables including audit and deletion-request tables, found %', rls_table_count;
  end if;

  if has_table_privilege('anon', 'public.course_contacts', 'UPDATE,DELETE,TRUNCATE') then
    raise exception 'Phase 0B: anonymous legacy-intake mutation remains';
  end if;

  if not has_table_privilege('anon', 'public.newsletter_subscribers', 'INSERT') then
    raise exception 'Phase 0B: newsletter signup privilege was broken';
  end if;

  if not has_table_privilege('authenticated', 'public.lesson_resources', 'SELECT') then
    raise exception 'Phase 0B: enrolled-resource read privilege was broken';
  end if;
end
$assertions$;
