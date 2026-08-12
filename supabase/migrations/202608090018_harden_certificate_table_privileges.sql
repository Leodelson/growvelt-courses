-- Growvelt Learning: remove residual browser table privileges from certificates.
-- Forward-only corrective hardening for applied Phase 2B-E migration 017.

begin;

do $$
begin
  if to_regclass('public.certificates') is null then
    raise exception 'Certificate privilege hardening aborted: certificates table is missing';
  end if;
  if not has_table_privilege('service_role', 'public.certificates', 'SELECT')
    or not has_table_privilege('service_role', 'public.certificates', 'INSERT')
    or not has_table_privilege('service_role', 'public.certificates', 'UPDATE')
    or not has_table_privilege('service_role', 'public.certificates', 'DELETE') then
    raise exception 'Certificate privilege hardening aborted: expected service_role operational access is missing';
  end if;
end;
$$;

revoke truncate, references, trigger on table public.certificates from public, anon, authenticated;

do $$
begin
  if has_table_privilege('public', 'public.certificates', 'SELECT')
    or has_table_privilege('public', 'public.certificates', 'INSERT')
    or has_table_privilege('public', 'public.certificates', 'UPDATE')
    or has_table_privilege('public', 'public.certificates', 'DELETE')
    or has_table_privilege('public', 'public.certificates', 'TRUNCATE')
    or has_table_privilege('public', 'public.certificates', 'REFERENCES')
    or has_table_privilege('public', 'public.certificates', 'TRIGGER')
    or has_table_privilege('anon', 'public.certificates', 'SELECT')
    or has_table_privilege('anon', 'public.certificates', 'INSERT')
    or has_table_privilege('anon', 'public.certificates', 'UPDATE')
    or has_table_privilege('anon', 'public.certificates', 'DELETE')
    or has_table_privilege('anon', 'public.certificates', 'TRUNCATE')
    or has_table_privilege('anon', 'public.certificates', 'REFERENCES')
    or has_table_privilege('anon', 'public.certificates', 'TRIGGER')
    or has_table_privilege('authenticated', 'public.certificates', 'SELECT')
    or has_table_privilege('authenticated', 'public.certificates', 'INSERT')
    or has_table_privilege('authenticated', 'public.certificates', 'UPDATE')
    or has_table_privilege('authenticated', 'public.certificates', 'DELETE')
    or has_table_privilege('authenticated', 'public.certificates', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.certificates', 'REFERENCES')
    or has_table_privilege('authenticated', 'public.certificates', 'TRIGGER') then
    raise exception 'Certificate privilege hardening aborted: browser table privileges remain';
  end if;
  if not has_table_privilege('service_role', 'public.certificates', 'SELECT')
    or not has_table_privilege('service_role', 'public.certificates', 'INSERT')
    or not has_table_privilege('service_role', 'public.certificates', 'UPDATE')
    or not has_table_privilege('service_role', 'public.certificates', 'DELETE') then
    raise exception 'Certificate privilege hardening aborted: service_role access changed unexpectedly';
  end if;
end;
$$;

commit;
