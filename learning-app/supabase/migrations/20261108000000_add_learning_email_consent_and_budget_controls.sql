-- Local preparation only. Apply after explicit Learning hosted approval.
begin;
alter table public.learning_email_preferences add column consent_version bigint not null default 0 check(consent_version>=0);
create table public.learning_email_consent_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  version bigint not null check(version>0), opted_in boolean not null,
  source text not null check(source in ('settings','unsubscribe')),
  recorded_at timestamptz not null default now(), primary key(user_id,version)
);
-- Desired state, not an assertion that the provider has already synchronized.
create table public.learning_email_consent_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null, opted_in boolean not null,
  updated_at timestamptz not null default now(),
  synchronized_version bigint not null default 0 check(synchronized_version>=0),
  check(synchronized_version<=version)
);
alter table public.learning_email_consent_events enable row level security;
alter table public.learning_email_consent_sync enable row level security;
revoke all on public.learning_email_consent_events,public.learning_email_consent_sync from public,anon,authenticated;
grant all on public.learning_email_consent_events,public.learning_email_consent_sync to service_role;

create function public.set_learning_email_preference(p_user_id uuid,p_opt_in boolean,p_source text default 'settings')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pref public.learning_email_preferences;
begin
  if p_opt_in is null or p_source is null or p_source not in ('settings','unsubscribe') or (p_source='unsubscribe' and p_opt_in) then
    raise exception 'Invalid consent change' using errcode='22023'; end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Confirmed Learning user required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('learning-consent-'||p_user_id::text,0));
  insert into public.learning_email_preferences(user_id) values(p_user_id) on conflict do nothing;
  select * into v_pref from public.learning_email_preferences where user_id=p_user_id for update;
  if v_pref.consent_version>0 and v_pref.marketing_opt_in=p_opt_in then
    return jsonb_build_object('marketingOptIn',p_opt_in,'version',v_pref.consent_version); end if;
  update public.learning_email_preferences set marketing_opt_in=p_opt_in,changed_at=now(),consent_version=consent_version+1
    where user_id=p_user_id returning * into v_pref;
  insert into public.learning_email_consent_events(user_id,version,opted_in,source)
    values(p_user_id,v_pref.consent_version,p_opt_in,p_source);
  insert into public.learning_email_consent_sync(user_id,version,opted_in) values(p_user_id,v_pref.consent_version,p_opt_in)
    on conflict(user_id) do update set version=excluded.version,opted_in=excluded.opted_in,updated_at=now();
  return jsonb_build_object('marketingOptIn',p_opt_in,'version',v_pref.consent_version);
end $$;

create function public.unsubscribe_learning_email_token(p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
  select p.user_id into v_user from public.learning_email_preferences p join auth.users u on u.id=p.user_id
    where p.unsubscribe_token=p_token and u.email_confirmed_at is not null;
  -- Same public result for an unknown token; no account-existence disclosure.
  if v_user is not null then perform public.set_learning_email_preference(v_user,false,'unsubscribe'); end if;
end $$;

create table public.learning_email_provider_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_id uuid not null, email text not null, version bigint not null,
  updated_at timestamptz not null default now()
);
-- Shared by consent sync and the future broadcast workflow. No automatic lease
-- expiry: a timed-out worker might still be changing provider membership.
create table public.learning_email_segment_lease (
  singleton boolean primary key default true check(singleton), holder uuid,
  kind text check(kind in ('consent','broadcast')), claimed_at timestamptz,
  check((holder is null and kind is null and claimed_at is null) or (holder is not null and kind is not null and claimed_at is not null))
);
insert into public.learning_email_segment_lease(singleton) values(true);
alter table public.learning_email_provider_links enable row level security;
alter table public.learning_email_segment_lease enable row level security;
revoke all on public.learning_email_provider_links,public.learning_email_segment_lease from public,anon,authenticated;
grant all on public.learning_email_provider_links,public.learning_email_segment_lease to service_role;

create function public.read_learning_email_consent_sync(p_user_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('userId',u.id,'email',lower(btrim(u.email)),'version',s.version,'optedIn',s.opted_in,'previousContactId',l.contact_id)
    from public.learning_email_consent_sync s join public.learning_email_preferences p on p.user_id=s.user_id
    join auth.users u on u.id=s.user_id left join public.learning_email_provider_links l on l.user_id=s.user_id
    where s.user_id=p_user_id and u.email is not null and u.email_confirmed_at is not null
      and (s.version>s.synchronized_version or (l.user_id is not null and l.email is distinct from lower(btrim(u.email))))
      and s.version=p.consent_version and s.opted_in=p.marketing_opt_in;
$$;
create function public.claim_learning_email_segment(p_holder uuid,p_kind text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_holder is null or p_kind is null or p_kind not in ('consent','broadcast') then raise exception 'Invalid segment lease' using errcode='22023'; end if;
  update public.learning_email_segment_lease set holder=p_holder,kind=p_kind,claimed_at=now() where singleton and holder is null;
  get diagnostics v_count=row_count; return v_count=1;
end $$;
create function public.release_learning_email_segment(p_holder uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  update public.learning_email_segment_lease set holder=null,kind=null,claimed_at=null where singleton and holder=p_holder;
  get diagnostics v_count=row_count; return v_count=1;
end $$;

-- A stale provider completion cannot acknowledge a newer opt-out/re-consent.
-- Invoke only after provider read-back, including preserved global suppression.
create function public.mark_learning_email_consent_synchronized(p_user_id uuid,p_version bigint,p_opt_in boolean,p_contact_id uuid default null,p_email text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_pref public.learning_email_preferences; v_changed integer;
begin
  if p_version is null or p_version<1 or p_opt_in is null then raise exception 'Invalid sync version' using errcode='22023'; end if;
  select * into v_pref from public.learning_email_preferences where user_id=p_user_id for update;
  if not found or v_pref.consent_version<>p_version or v_pref.marketing_opt_in<>p_opt_in then return false; end if;
  if not exists(select 1 from public.learning_email_consent_sync where user_id=p_user_id and version=p_version and opted_in=p_opt_in) then return false; end if;
  if p_contact_id is not null then
    if p_email is null or not exists(select 1 from auth.users where id=p_user_id and lower(btrim(email))=p_email and email_confirmed_at is not null) then return false; end if;
    insert into public.learning_email_provider_links(user_id,contact_id,email,version) values(p_user_id,p_contact_id,p_email,p_version)
      on conflict(user_id) do update set contact_id=excluded.contact_id,email=excluded.email,version=excluded.version,updated_at=now();
  end if;
  update public.learning_email_consent_sync set synchronized_version=p_version
    where user_id=p_user_id and version=p_version and opted_in=p_opt_in;
  get diagnostics v_changed=row_count;
  return v_changed=1;
end $$;

create or replace function public.claim_learning_email_center_attempt(p_actor uuid,p_id uuid,p_revision integer,p_target_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_row public.learning_email_center_drafts; v_inserted integer;
begin
  perform public.learning_email_center_check_operator(p_actor);
  select * into v_row from public.learning_email_center_drafts where id=p_id for update;
  if not found or p_revision is null or v_row.revision<>p_revision or v_row.status not in ('reviewed','sending') then
    raise exception 'Review required' using errcode='40001'; end if;
  if exists(select 1 from public.learning_email_center_targets t left join auth.users u on u.id=t.user_id
    where t.draft_id=p_id and (u.email_confirmed_at is null or lower(btrim(u.email)) is distinct from t.email)) then
    raise exception 'Account changed; review again' using errcode='40001'; end if;
  if v_row.document->>'mode'='marketing' then
    if p_target_key is null or p_target_key<>'broadcast' then raise exception 'Broadcast required' using errcode='22023'; end if;
    if exists(select 1 from public.learning_email_center_targets t left join public.learning_email_preferences p on p.user_id=t.user_id where t.draft_id=p_id and p.marketing_opt_in is distinct from true) then
      raise exception 'Consent changed; review again' using errcode='40001'; end if;
    if exists(select 1 from public.learning_email_center_targets t join public.learning_email_consent_sync s on s.user_id=t.user_id
      where t.draft_id=p_id and s.synchronized_version<s.version) then
      raise exception 'Consent synchronization pending' using errcode='40001'; end if;
    if exists(select 1 from public.learning_email_center_targets t join public.learning_email_provider_links l on l.user_id=t.user_id
      where t.draft_id=p_id and l.email is distinct from t.email) then
      raise exception 'Identity synchronization pending' using errcode='40001'; end if;
  elsif not exists(select 1 from public.learning_email_center_targets where draft_id=p_id and user_id::text=p_target_key) then
    raise exception 'Unknown target' using errcode='22023'; end if;
  insert into public.learning_email_center_attempts(draft_id,target_key) values(p_id,p_target_key) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=1 then update public.learning_email_center_drafts set status='sending',updated_at=now() where id=p_id; end if;
  return v_inserted=1;
end $$;

-- Email Center only: this is NOT a shared Careers/Auth/course quota allocator.
-- Starts disabled. An approved short-lived allocation is required before send.
create table public.learning_email_center_budget_policy (
  singleton boolean primary key default true check(singleton),
  daily_limit integer not null default 0 check(daily_limit between 0 and 10),
  monthly_limit integer not null default 0 check(monthly_limit between 0 and 100),
  approved_until timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.learning_email_center_budget_policy(singleton) values(true);
create table public.learning_email_center_budget_reservations (
  draft_id uuid not null, target_key text not null,
  reserved_at timestamptz not null default now(),
  primary key(draft_id,target_key),
  foreign key(draft_id,target_key) references public.learning_email_center_attempts(draft_id,target_key) on delete restrict
);
create index learning_email_center_budget_reserved_idx on public.learning_email_center_budget_reservations(reserved_at);
alter table public.learning_email_center_budget_policy enable row level security;
alter table public.learning_email_center_budget_reservations enable row level security;
revoke all on public.learning_email_center_budget_policy,public.learning_email_center_budget_reservations from public,anon,authenticated;
grant all on public.learning_email_center_budget_policy,public.learning_email_center_budget_reservations to service_role;

create function public.reserve_learning_email_center_budget(p_actor uuid,p_id uuid,p_revision integer,p_target_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_draft public.learning_email_center_drafts; v_policy public.learning_email_center_budget_policy;
  v_day_start timestamptz; v_month_start timestamptz; v_day_count integer; v_month_count integer;
begin
  perform public.learning_email_center_check_operator(p_actor);
  select * into v_draft from public.learning_email_center_drafts where id=p_id for update;
  if not found or p_revision is null or v_draft.revision<>p_revision or v_draft.document->>'mode'<>'transactional'
    or v_draft.status<>'sending' then raise exception 'Claimed account notice required' using errcode='40001'; end if;
  if not exists(select 1 from public.learning_email_center_attempts where draft_id=p_id and target_key=p_target_key and state='claimed') then
    raise exception 'Claim required' using errcode='40001'; end if;
  select * into v_policy from public.learning_email_center_budget_policy where singleton for update;
  if exists(select 1 from public.learning_email_center_budget_reservations where draft_id=p_id and target_key=p_target_key) then return true; end if;
  if v_policy.daily_limit=0 or v_policy.monthly_limit=0 or v_policy.approved_until is null or v_policy.approved_until<=now()
    or v_policy.approved_until>v_policy.updated_at+interval '15 minutes' or v_policy.approved_by is null then return false; end if;
  perform public.learning_email_center_check_operator(v_policy.approved_by);
  v_day_start:=pg_catalog.date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  v_month_start:=pg_catalog.date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) filter(where reserved_at>=v_day_start)::integer,count(*)::integer into v_day_count,v_month_count
    from public.learning_email_center_budget_reservations where reserved_at>=v_month_start;
  if v_day_count>=v_policy.daily_limit or v_month_count>=v_policy.monthly_limit then return false; end if;
  insert into public.learning_email_center_budget_reservations(draft_id,target_key) values(p_id,p_target_key);
  return true;
end $$;
revoke all on function public.set_learning_email_preference(uuid,boolean,text),public.unsubscribe_learning_email_token(uuid),public.mark_learning_email_consent_synchronized(uuid,bigint,boolean,uuid,text),public.reserve_learning_email_center_budget(uuid,uuid,integer,text),public.read_learning_email_consent_sync(uuid),public.claim_learning_email_segment(uuid,text),public.release_learning_email_segment(uuid) from public,anon,authenticated;
grant execute on function public.set_learning_email_preference(uuid,boolean,text),public.unsubscribe_learning_email_token(uuid),public.mark_learning_email_consent_synchronized(uuid,bigint,boolean,uuid,text),public.reserve_learning_email_center_budget(uuid,uuid,integer,text),public.read_learning_email_consent_sync(uuid),public.claim_learning_email_segment(uuid,text),public.release_learning_email_segment(uuid) to service_role;
commit;
