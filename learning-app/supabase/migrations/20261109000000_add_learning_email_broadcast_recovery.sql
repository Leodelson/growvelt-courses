-- LOCAL ONLY: requires release approval before applying to Learning.
begin;
create table public.learning_email_broadcast_operations (
  draft_id uuid primary key references public.learning_email_center_drafts(id) on delete restrict,
  revision integer not null, holder uuid not null unique,
  phase text not null check(phase in ('syncing','creating','draft','dispatching','queued','sent','canceled','abandoned')),
  provider_id uuid unique, provider_status text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.learning_email_release_approvals (
  draft_id uuid primary key references public.learning_email_center_drafts(id) on delete restrict,
  revision integer not null, approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(), expires_at timestamptz not null,
  recipients jsonb not null check(jsonb_typeof(recipients)='array')
);
create table public.learning_email_recovery_events (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.learning_email_center_drafts(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null, phase text not null, provider_id uuid, recorded_at timestamptz not null default now()
);
alter table public.learning_email_broadcast_operations enable row level security;
alter table public.learning_email_release_approvals enable row level security;
alter table public.learning_email_recovery_events enable row level security;
revoke all on public.learning_email_broadcast_operations,public.learning_email_release_approvals,public.learning_email_recovery_events from public,anon,authenticated;
grant all on public.learning_email_broadcast_operations,public.learning_email_release_approvals,public.learning_email_recovery_events to service_role;
grant usage,select on sequence public.learning_email_recovery_events_id_seq to service_role;

-- Fresh, exact saved recipients; no browser-supplied account attributes.
create function public.read_learning_email_center_review(p_actor uuid,p_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_draft public.learning_email_center_drafts; v_targets jsonb;
begin
  perform public.learning_email_center_check_operator(p_actor);
  select * into v_draft from public.learning_email_center_drafts where id=p_id;
  if not found or p_revision is null or v_draft.revision<>p_revision or v_draft.status='draft' then
    raise exception 'Saved review required' using errcode='40001'; end if;
  if exists(select 1 from public.learning_email_center_targets t left join auth.users u on u.id=t.user_id
    left join public.learning_email_preferences p on p.user_id=t.user_id where t.draft_id=p_id and
      (u.email_confirmed_at is null or lower(btrim(u.email)) is distinct from t.email
        or (v_draft.document->>'mode'='marketing' and p.marketing_opt_in is distinct from true))) then
    raise exception 'Identity or consent changed; do not send' using errcode='40001'; end if;
  select jsonb_agg(jsonb_build_object('userId',t.user_id,'email',t.email,'firstName',t.first_name,
    'confirmed',true,'marketingOptIn',coalesce(p.marketing_opt_in,false)) order by t.email) into v_targets
    from public.learning_email_center_targets t left join public.learning_email_preferences p on p.user_id=t.user_id where t.draft_id=p_id;
  if v_targets is null then raise exception 'No reviewed recipients' using errcode='22023'; end if;
  return jsonb_build_object('document',v_draft.document,'targets',v_targets);
end $$;

-- Approval is short-lived and bound to immutable saved content and exact emails.
-- Does not activate the server's separate release gate or send anything.
create function public.approve_learning_email_release(p_actor uuid,p_id uuid,p_revision integer,p_recipients jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_review jsonb; v_emails jsonb;
begin
  perform public.learning_email_center_check_operator(p_actor);
  perform 1 from public.learning_email_center_drafts where id=p_id for update;
  v_review:=public.read_learning_email_center_review(p_actor,p_id,p_revision);
  select jsonb_agg(value->>'email' order by value->>'email') into v_emails from jsonb_array_elements(v_review->'targets');
  if p_recipients is distinct from v_emails then raise exception 'Confirm the exact reviewed emails' using errcode='40001'; end if;
  insert into public.learning_email_release_approvals(draft_id,revision,approved_by,expires_at,recipients)
    values(p_id,p_revision,p_actor,now()+interval '15 minutes',v_emails)
    on conflict(draft_id) do update set revision=excluded.revision,approved_by=p_actor,approved_at=now(),expires_at=excluded.expires_at,recipients=v_emails;
  insert into public.learning_email_recovery_events(draft_id,actor_id,action,phase) values(p_id,p_actor,'release_approved','approval');
end $$;
create function public.check_learning_email_release(p_actor uuid,p_id uuid,p_revision integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_review jsonb; v_emails jsonb;
begin
  v_review:=public.read_learning_email_center_review(p_actor,p_id,p_revision);
  select jsonb_agg(value->>'email' order by value->>'email') into v_emails from jsonb_array_elements(v_review->'targets');
  return exists(select 1 from public.learning_email_release_approvals where draft_id=p_id and revision=p_revision
    and expires_at>now() and recipients=v_emails);
end $$;

create function public.start_learning_email_broadcast(p_actor uuid,p_id uuid,p_revision integer,p_holder uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_review jsonb;
begin
  perform public.learning_email_center_check_operator(p_actor);
  perform 1 from public.learning_email_center_drafts where id=p_id for update;
  if exists(select 1 from public.learning_email_center_attempts where draft_id=p_id) then return false; end if;
  v_review:=public.read_learning_email_center_review(p_actor,p_id,p_revision);
  if v_review->'document'->>'mode'<>'marketing' then raise exception 'Marketing draft required' using errcode='22023'; end if;
  if not public.claim_learning_email_segment(p_holder,'broadcast') then return false; end if;
  insert into public.learning_email_center_attempts(draft_id,target_key) values(p_id,'broadcast');
  insert into public.learning_email_broadcast_operations(draft_id,revision,holder,phase) values(p_id,p_revision,p_holder,'syncing');
  update public.learning_email_center_drafts set status='sending',updated_at=now() where id=p_id;
  insert into public.learning_email_recovery_events(draft_id,actor_id,action,phase) values(p_id,p_actor,'prepare_claimed','syncing');
  return true;
end $$;

-- Compare-and-swap phases: no automatic claim expiry, recreate, or redispatch.
create function public.advance_learning_email_broadcast(p_actor uuid,p_id uuid,p_expected text,p_next text,p_provider_id uuid default null,p_provider_status text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_op public.learning_email_broadcast_operations;
begin
  perform public.learning_email_center_check_operator(p_actor);
  if p_expected is null or p_next is null then raise exception 'Explicit recovery phases required' using errcode='22023'; end if;
  perform 1 from public.learning_email_center_drafts where id=p_id for update;
  select * into v_op from public.learning_email_broadcast_operations where draft_id=p_id for update;
  if not found or v_op.phase<>p_expected then return false; end if;
  if not exists(select 1 from public.learning_email_segment_lease where singleton and holder=v_op.holder and kind='broadcast') then
    raise exception 'Segment ownership lost' using errcode='40001'; end if;
  if not ((p_expected='syncing' and p_next in ('creating','abandoned'))
    or (p_expected='creating' and p_next='draft' and p_provider_id is not null)
    or (p_expected='draft' and p_next in ('dispatching','abandoned'))
    or (p_expected in ('dispatching','queued') and p_next in ('queued','sent','canceled')))
    then raise exception 'Unsafe recovery transition' using errcode='22023'; end if;
  if v_op.provider_id is not null and p_provider_id is distinct from v_op.provider_id then
    raise exception 'Provider identity mismatch' using errcode='40001'; end if;
  if p_next='dispatching' and not public.check_learning_email_release(p_actor,p_id,v_op.revision) then
    raise exception 'Release approval required' using errcode='42501'; end if;
  update public.learning_email_broadcast_operations set phase=p_next,provider_id=coalesce(provider_id,p_provider_id),provider_status=p_provider_status,updated_at=now() where draft_id=p_id;
  update public.learning_email_center_attempts set provider_id=coalesce(p_provider_id::text,provider_id),
    state=case when p_next in ('queued','sent') then 'accepted' when p_next in ('canceled','abandoned') then 'skipped' else state end, checked_at=now()
    where draft_id=p_id and target_key='broadcast';
  update public.learning_email_center_drafts set status=case when p_next='sent' then 'accepted' when p_next in ('canceled','abandoned') then 'needs_review' else 'sending' end,updated_at=now() where id=p_id;
  insert into public.learning_email_recovery_events(draft_id,actor_id,action,phase,provider_id) values(p_id,p_actor,'phase_verified',p_next,p_provider_id);
  if p_next in ('sent','canceled','abandoned') then perform public.release_learning_email_segment(v_op.holder); end if;
  return true;
end $$;
revoke all on function public.read_learning_email_center_review(uuid,uuid,integer),public.approve_learning_email_release(uuid,uuid,integer,jsonb),public.check_learning_email_release(uuid,uuid,integer),public.start_learning_email_broadcast(uuid,uuid,integer,uuid),public.advance_learning_email_broadcast(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.read_learning_email_center_review(uuid,uuid,integer),public.approve_learning_email_release(uuid,uuid,integer,jsonb),public.check_learning_email_release(uuid,uuid,integer),public.start_learning_email_broadcast(uuid,uuid,integer,uuid),public.advance_learning_email_broadcast(uuid,uuid,text,text,uuid,text) to service_role;
commit;
