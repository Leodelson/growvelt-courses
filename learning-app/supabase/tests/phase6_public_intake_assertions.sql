-- Read-only post-activation checks. Never submit a real email as a smoke test.
do $assertions$
begin
  if (select count(*) from public.learning_public_intake_limits where kind in ('newsletter','inquiry')) <> 2 then
    raise exception 'Intake configuration is incomplete'; end if;
  if (select count(*) from pg_catalog.pg_class where oid in ('public.learning_public_intake_limits'::regclass,'public.learning_public_intake_counters'::regclass) and relrowsecurity) <> 2 then
    raise exception 'Quota RLS is disabled'; end if;
  if (select count(*) from pg_catalog.pg_trigger where tgname='learning_public_intake_guard'
    and tgrelid in ('public.newsletter_subscribers'::regclass,'public.learning_public_inquiries'::regclass)
    and not tgisinternal and tgenabled='O') <> 2 then
    raise exception 'Intake guards are not enabled'; end if;
  if has_table_privilege('anon','public.learning_public_intake_counters','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.learning_public_intake_counters','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.learning_public_intake_limits','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.learning_public_intake_limits','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Public access to private quota state'; end if;
  if has_function_privilege('anon','public.consume_learning_public_intake_budget(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.consume_learning_public_intake_budget(text,text)','EXECUTE') then
    raise exception 'Public access to quota helper'; end if;
  if not has_table_privilege('anon','public.newsletter_subscribers','INSERT')
    or not has_function_privilege('anon','public.submit_public_learning_inquiry(text,text,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'Existing public submission path was broken'; end if;
end;
$assertions$;
select kind,hourly_limit,daily_limit,email_hourly_limit,email_daily_limit
from public.learning_public_intake_limits order by kind;
