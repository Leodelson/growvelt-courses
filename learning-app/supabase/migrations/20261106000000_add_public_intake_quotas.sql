-- Prepared locally only. Deploy the compatible HTTP error handling first,
-- then review/approve limits and apply this migration in a separate operation.
-- Existing newsletter INSERT and inquiry RPC permissions are preserved.
begin;

create table if not exists public.learning_public_intake_limits (
  kind text primary key check (kind in ('newsletter', 'inquiry')),
  hourly_limit integer not null check (hourly_limit between 1 and 100000),
  daily_limit integer not null check (daily_limit between 1 and 100000),
  email_hourly_limit integer not null check (email_hourly_limit between 1 and 100000),
  email_daily_limit integer not null check (email_daily_limit between 1 and 100000)
);
create table if not exists public.learning_public_intake_counters (
  kind text not null references public.learning_public_intake_limits(kind),
  subject_key text not null check (subject_key = 'all' or subject_key ~ '^email:[0-9a-f]{64}$'),
  window_seconds integer not null check (window_seconds in (3600, 86400)),
  window_start timestamptz not null,
  accepted_count integer not null check (accepted_count > 0),
  primary key (kind, subject_key, window_seconds, window_start)
);
create index if not exists learning_public_intake_counters_window_idx
  on public.learning_public_intake_counters(window_start);
alter table public.learning_public_intake_limits enable row level security;
alter table public.learning_public_intake_counters enable row level security;
revoke all on public.learning_public_intake_limits, public.learning_public_intake_counters from public, anon, authenticated;
grant select, insert, update, delete on public.learning_public_intake_limits, public.learning_public_intake_counters to service_role;

-- Starter safety budgets, NOT a statement of observed traffic or email consent.
-- Reapplying preserves any operator-reviewed values.
insert into public.learning_public_intake_limits values
  ('newsletter', 200, 1000, 1, 1), ('inquiry', 50, 200, 3, 5)
on conflict (kind) do nothing;

create or replace function public.consume_learning_public_intake_budget(p_kind text, p_email text)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  limits public.learning_public_intake_limits%rowtype;
  captured_at timestamptz := pg_catalog.clock_timestamp();
  bucket_start timestamptz;
  subject text;
  maximum integer;
  seconds integer;
  used integer;
  slot integer;
  email_key text := 'email:' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_email, 'UTF8')), 'hex');
begin
  select * into limits from public.learning_public_intake_limits where kind = p_kind;
  if not found then raise exception 'Invalid intake kind' using errcode = '22023'; end if;

  -- Same row acquisition order for every caller. Conditional UPSERT increments
  -- atomically; a rejected insert rolls back every counter change with it.
  for slot in 1..4 loop
    seconds := case when slot in (1,3) then 3600 else 86400 end;
    subject := case when slot <= 2 then 'all' else email_key end;
    maximum := case slot when 1 then limits.hourly_limit when 2 then limits.daily_limit
      when 3 then limits.email_hourly_limit else limits.email_daily_limit end;
    bucket_start := pg_catalog.to_timestamp(pg_catalog.floor(extract(epoch from captured_at) / seconds) * seconds);
    insert into public.learning_public_intake_counters as counter
      (kind, subject_key, window_seconds, window_start, accepted_count)
    values (p_kind, subject, seconds, bucket_start, 1)
    on conflict (kind, subject_key, window_seconds, window_start) do update
      set accepted_count = counter.accepted_count + 1
      where counter.accepted_count < maximum
    returning accepted_count into used;
    if not found then
      raise exception 'Submission limit reached. Please try again later.' using errcode = 'PT429';
    end if;
  end loop;

  -- On-write housekeeping; no new paid service or cron. Not an idle-time TTL.
  delete from public.learning_public_intake_counters where window_start < captured_at - interval '2 days';
end;
$function$;
revoke all on function public.consume_learning_public_intake_budget(text,text) from public, anon, authenticated, service_role;

create or replace function public.guard_learning_public_intake()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  intake_kind text;
begin
  if tg_op <> 'INSERT' or tg_table_schema <> 'public' or tg_table_name not in ('newsletter_subscribers','learning_public_inquiries') then
    raise exception 'Invalid intake trigger' using errcode = '22023';
  end if;
  new.email := pg_catalog.lower(pg_catalog.btrim(new.email));
  if new.email is null or pg_catalog.char_length(new.email) not between 3 and 254
    or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.char_length(coalesce(new.source_page,'')) > 160 then
    raise exception 'Invalid public submission' using errcode = '22023';
  end if;
  -- Public callers must not backdate rows or inject arbitrarily large metadata.
  new.created_at := pg_catalog.clock_timestamp();
  intake_kind := case tg_table_name when 'newsletter_subscribers' then 'newsletter' else 'inquiry' end;
  if intake_kind = 'newsletter' and exists (
    select 1 from public.newsletter_subscribers where pg_catalog.lower(email) = new.email
  ) then
    raise exception 'Subscription already exists' using errcode = '23505';
  end if;
  perform public.consume_learning_public_intake_budget(intake_kind, new.email);
  return new;
end;
$function$;
revoke all on function public.guard_learning_public_intake() from public, anon, authenticated, service_role;
create index if not exists newsletter_subscribers_normalized_email_idx
  on public.newsletter_subscribers(pg_catalog.lower(email));
drop trigger if exists learning_public_intake_guard on public.newsletter_subscribers;
create trigger learning_public_intake_guard before insert on public.newsletter_subscribers
  for each row execute function public.guard_learning_public_intake();
drop trigger if exists learning_public_intake_guard on public.learning_public_inquiries;
create trigger learning_public_intake_guard before insert on public.learning_public_inquiries
  for each row execute function public.guard_learning_public_intake();

commit;
