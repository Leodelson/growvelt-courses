-- Transactional administrator alerts. References only: no copied form payloads,
-- no provider/network calls in database transactions, no historical backfill.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
create table public.learning_admin_submission_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in('inquiry','instructor','provider','course','support')),
  source_id text not null check(length(source_id) between 1 and 80),
  source_version text not null check(length(source_version) between 1 and 80),
  actor_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(kind,source_id,source_version)
);
create table public.learning_admin_submission_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.learning_admin_submission_alerts(id) on delete cascade,
  recipient text not null check(recipient in('owner','admin')),
  state text not null default 'pending' check(state in('pending','dispatching','accepted','failed','uncertain')),
  not_before timestamptz not null default now(),
  attempted_at timestamptz, provider_id uuid, failure_code text,
  unique(alert_id,recipient)
);
create index learning_admin_submission_pending_idx on public.learning_admin_submission_deliveries(not_before,id) where state='pending';
create index learning_admin_submission_created_idx on public.learning_admin_submission_alerts(created_at desc,id);
create table public.learning_admin_alert_daily_budget(day date primary key,reserved integer not null check(reserved between 0 and 20));
create table public.learning_admin_alert_run(id boolean primary key default true check(id),holder uuid,expires_at timestamptz not null default '-infinity');
insert into public.learning_admin_alert_run(id) values(true);
alter table public.learning_admin_submission_alerts enable row level security;
alter table public.learning_admin_submission_deliveries enable row level security;
alter table public.learning_admin_alert_daily_budget enable row level security;
alter table public.learning_admin_alert_run enable row level security;
revoke all on public.learning_admin_submission_alerts,public.learning_admin_submission_deliveries,public.learning_admin_alert_daily_budget,public.learning_admin_alert_run from public,anon,authenticated;
grant all on public.learning_admin_submission_alerts,public.learning_admin_submission_deliveries,public.learning_admin_alert_daily_budget,public.learning_admin_alert_run to service_role;

create function public.capture_learning_admin_submission_alert() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; sid text; ver text; actor uuid; aid uuid;
begin
  if tg_table_name='learning_public_inquiries' then
    k:='inquiry';sid:=new.id::text;ver:=new.created_at::text;
  elsif tg_table_name='instructor_profiles' then
    if new.approval_status<>'pending' then return new; end if;
    k:='instructor';sid:=new.user_id::text;ver:=new.created_at::text;actor:=new.user_id;
  elsif tg_table_name='learning_provider_organization_verifications' then
    if new.status<>'pending' then return new; end if;
    if tg_op='UPDATE' and old.status='pending' and old.submitted_at=new.submitted_at then return new; end if;
    k:='provider';sid:=new.organization_id::text;ver:=new.submitted_at::text;actor:=new.submitted_by;
  elsif tg_table_name='learning_courses' then
    if new.status<>'pending_review' or old.status='pending_review' then return new; end if;
    k:='course';sid:=new.id::text;ver:=new.submitted_at::text;actor:=new.instructor_id;
  elsif tg_table_name='learning_support_messages' then
    if new.sender_role<>'customer' then return new; end if;
    k:='support';sid:=new.id::text;ver:=new.created_at::text;actor:=new.sender_user_id;
  else raise exception 'Unsupported admin alert trigger'; end if;
  insert into public.learning_admin_submission_alerts(kind,source_id,source_version,actor_id)
    values(k,sid,ver,actor) on conflict do nothing returning id into aid;
  if aid is not null then
    insert into public.learning_admin_submission_deliveries(alert_id,recipient) values(aid,'owner'),(aid,'admin');
  end if;
  return new;
end;$$;
revoke all on function public.capture_learning_admin_submission_alert() from public,anon,authenticated;
create trigger admin_submission_alert after insert on public.learning_public_inquiries for each row execute function public.capture_learning_admin_submission_alert();
create trigger admin_submission_alert after insert on public.instructor_profiles for each row execute function public.capture_learning_admin_submission_alert();
create trigger admin_submission_alert after insert or update on public.learning_provider_organization_verifications for each row execute function public.capture_learning_admin_submission_alert();
create trigger admin_submission_alert after update of status on public.learning_courses for each row when(new.status='pending_review' and old.status is distinct from new.status) execute function public.capture_learning_admin_submission_alert();
create trigger admin_submission_alert after insert on public.learning_support_messages for each row execute function public.capture_learning_admin_submission_alert();

create function public.acquire_learning_admin_alert_run(p_holder uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.learning_admin_alert_run set holder=p_holder,expires_at=now()+interval '90 seconds' where id and expires_at<now();
  return found;
end;$$;
create function public.release_learning_admin_alert_run(p_holder uuid) returns void language sql security definer set search_path='' as $$
  update public.learning_admin_alert_run set holder=null,expires_at='-infinity' where id and holder=p_holder;
$$;
create function public.claim_learning_admin_submission_delivery(p_id uuid,p_holder uuid,p_daily_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; used integer;
begin
  if p_daily_limit is null or p_daily_limit not in(10,20) or not exists(select 1 from public.learning_admin_alert_run where id and holder=p_holder and expires_at>now()) then return false; end if;
  perform 1 from public.learning_admin_submission_deliveries where id=p_id and state='pending' and not_before<=now() for update;
  if not found then return false; end if;
  insert into public.learning_admin_alert_daily_budget(day,reserved) values(today,0) on conflict do nothing;
  select reserved into used from public.learning_admin_alert_daily_budget where day=today for update;
  if used>=p_daily_limit then return false; end if;
  update public.learning_admin_alert_daily_budget set reserved=reserved+1 where day=today;
  update public.learning_admin_submission_deliveries set state='dispatching',attempted_at=now(),failure_code=null where id=p_id;
  return true;
end;$$;
revoke all on function public.acquire_learning_admin_alert_run(uuid),public.release_learning_admin_alert_run(uuid),public.claim_learning_admin_submission_delivery(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.acquire_learning_admin_alert_run(uuid),public.release_learning_admin_alert_run(uuid),public.claim_learning_admin_submission_delivery(uuid,uuid,integer) to service_role;
commit;
