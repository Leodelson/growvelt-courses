-- Local preparation only. Apply to Learning only after explicit hosted approval.
begin;
create table public.learning_email_center_drafts (
  id uuid primary key,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 32768),
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft','reviewed','sending','accepted','needs_review')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete restrict
);
create table public.learning_email_center_targets (
  draft_id uuid not null references public.learning_email_center_drafts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  email text not null, first_name text not null default 'there',
  primary key(draft_id,user_id), unique(draft_id,email)
);
create table public.learning_email_center_attempts (
  draft_id uuid not null references public.learning_email_center_drafts(id) on delete restrict,
  target_key text not null,
  state text not null default 'claimed' check (state in ('claimed','accepted','uncertain','skipped')),
  provider_id text, claimed_at timestamptz not null default now(), checked_at timestamptz,
  primary key(draft_id,target_key)
);
alter table public.learning_email_center_drafts enable row level security;
alter table public.learning_email_center_targets enable row level security;
alter table public.learning_email_center_attempts enable row level security;
revoke all on public.learning_email_center_drafts,public.learning_email_center_targets,public.learning_email_center_attempts from public,anon,authenticated;
grant all on public.learning_email_center_drafts,public.learning_email_center_targets,public.learning_email_center_attempts to service_role;

-- This service-only check does not grant platform admin status. The application
-- must additionally pass the existing is_growvelt_learning_admin session RPC.
create function public.learning_email_center_check_operator(p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null
    and lower(btrim(email)) in ('nduleonardc@gmail.com','admin@growvelt.com')) then
    raise exception 'Email operator required' using errcode='42501';
  end if;
end $$;

create function public.save_learning_email_center_draft(p_actor uuid,p_id uuid,p_revision integer,p_document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.learning_email_center_drafts;
begin
  perform public.learning_email_center_check_operator(p_actor);
  if p_revision < 0 or p_revision is null or p_id is null or p_document is null then raise exception 'Invalid draft' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_row from public.learning_email_center_drafts where id=p_id for update;
  if found then
    if v_row.status not in ('draft','reviewed') then raise exception 'Sending content is locked' using errcode='40001'; end if;
    if v_row.revision=p_revision+1 and v_row.document=p_document then return jsonb_build_object('id',p_id,'revision',v_row.revision); end if;
    if v_row.revision<>p_revision then raise exception 'Draft changed; reload it' using errcode='40001'; end if;
    delete from public.learning_email_center_targets where draft_id=p_id;
    update public.learning_email_center_drafts set document=p_document,revision=revision+1,status='draft',
      updated_by=p_actor,updated_at=now(),reviewed_by=null,reviewed_at=null where id=p_id returning * into v_row;
  else
    if p_revision<>0 then raise exception 'Draft not found' using errcode='40001'; end if;
    insert into public.learning_email_center_drafts(id,created_by,updated_by,document)
      values(p_id,p_actor,p_actor,p_document) returning * into v_row;
  end if;
  return jsonb_build_object('id',p_id,'revision',v_row.revision);
end $$;

create function public.review_learning_email_center_draft(p_actor uuid,p_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.learning_email_center_drafts; v_count integer; v_requested integer; v_matched integer;
begin
  perform public.learning_email_center_check_operator(p_actor);
  select * into v_row from public.learning_email_center_drafts where id=p_id for update;
  if not found or v_row.revision<>p_revision or v_row.status not in ('draft','reviewed') then
    raise exception 'Draft changed; reload it' using errcode='40001'; end if;
  delete from public.learning_email_center_targets where draft_id=p_id;
  if v_row.document->>'audience'='specific' then
    select count(*) into v_requested from jsonb_array_elements_text(v_row.document->'recipients');
    select count(*) into v_matched from jsonb_array_elements_text(v_row.document->'recipients') r(value)
      where exists(select 1 from auth.users u join public.profiles p on p.id=u.id
        where lower(btrim(u.email))=r.value or u.id::text=r.value);
    if v_requested<>v_matched then raise exception 'Some selected Learning accounts were not found' using errcode='22023'; end if;
  end if;
  insert into public.learning_email_center_targets(draft_id,user_id,email,first_name)
    select distinct on (lower(btrim(u.email))) p_id,u.id,lower(btrim(u.email)),
      coalesce(nullif(split_part(btrim(coalesce(u.raw_user_meta_data->>'full_name','')), ' ',1),''),'there')
    from auth.users u join public.profiles p on p.id=u.id
    left join public.learning_email_preferences pref on pref.user_id=u.id
    where u.email is not null and u.email_confirmed_at is not null
      and (v_row.document->>'mode'='transactional' or pref.marketing_opt_in is true)
      and (
        v_row.document->>'audience'='all'
        or (v_row.document->>'audience'='learners' and p.account_type='learner')
        or (v_row.document->>'audience'='instructors' and exists(select 1 from public.instructor_profiles i where i.user_id=u.id and i.approval_status='approved'))
        or (v_row.document->>'audience'='organizations' and exists(select 1 from public.learning_company_memberships m join public.learning_company_workspaces w on w.id=m.workspace_id where m.user_id=u.id and m.status='active' and m.role in ('owner','admin') and w.status='active'))
        or (v_row.document->>'audience'='specific' and exists(select 1 from jsonb_array_elements_text(v_row.document->'recipients') r(value) where r.value=u.id::text or r.value=lower(btrim(u.email))))
      ) order by lower(btrim(u.email)),u.id;
  get diagnostics v_count=row_count;
  if v_count=0 or v_count>1000 or (v_row.document->>'mode'='transactional' and v_count>10) then
    raise exception 'No eligible recipients, or review limit exceeded' using errcode='22023'; end if;
  update public.learning_email_center_drafts set status='reviewed',reviewed_at=now(),reviewed_by=p_actor where id=p_id;
  return jsonb_build_object('id',p_id,'revision',p_revision,'recipients',v_count,'status','reviewed');
end $$;

create function public.claim_learning_email_center_attempt(p_actor uuid,p_id uuid,p_revision integer,p_target_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_row public.learning_email_center_drafts; v_inserted integer;
begin
  perform public.learning_email_center_check_operator(p_actor);
  select * into v_row from public.learning_email_center_drafts where id=p_id for update;
  if not found or v_row.revision<>p_revision or v_row.status not in ('reviewed','sending') then
    raise exception 'Review required' using errcode='40001'; end if;
  if exists(select 1 from public.learning_email_center_targets t left join auth.users u on u.id=t.user_id
    where t.draft_id=p_id and (u.email_confirmed_at is null or lower(btrim(u.email)) is distinct from t.email)) then
    raise exception 'Account changed; review again' using errcode='40001'; end if;
  if v_row.document->>'mode'='marketing' then
    if p_target_key<>'broadcast' then raise exception 'Broadcast required' using errcode='22023'; end if;
    if exists(select 1 from public.learning_email_center_targets t left join public.learning_email_preferences p on p.user_id=t.user_id where t.draft_id=p_id and p.marketing_opt_in is distinct from true) then
      raise exception 'Consent changed; review again' using errcode='40001'; end if;
  elsif not exists(select 1 from public.learning_email_center_targets where draft_id=p_id and user_id::text=p_target_key) then
    raise exception 'Unknown target' using errcode='22023';
  end if;
  insert into public.learning_email_center_attempts(draft_id,target_key) values(p_id,p_target_key) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=1 then update public.learning_email_center_drafts set status='sending',updated_at=now() where id=p_id; end if;
  return v_inserted=1;
end $$;

create function public.complete_learning_email_center_attempt(p_actor uuid,p_id uuid,p_target_key text,p_state text,p_provider_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_existing public.learning_email_center_attempts; v_expected integer; v_accepted integer;
begin
  perform public.learning_email_center_check_operator(p_actor);
  perform 1 from public.learning_email_center_drafts where id=p_id for update;
  if p_state not in ('accepted','uncertain','skipped') or (p_state='accepted' and (nullif(btrim(p_provider_id),'') is null or char_length(p_provider_id)>160)) then
    raise exception 'Invalid checkpoint' using errcode='22023'; end if;
  select * into v_existing from public.learning_email_center_attempts where draft_id=p_id and target_key=p_target_key for update;
  if not found then raise exception 'Attempt not found' using errcode='22023'; end if;
  if v_existing.state<>'claimed' then
    if v_existing.state=p_state and v_existing.provider_id is not distinct from p_provider_id then return; end if;
    raise exception 'Reconciliation required' using errcode='40001';
  end if;
  update public.learning_email_center_attempts set state=p_state,provider_id=p_provider_id,checked_at=now() where draft_id=p_id and target_key=p_target_key;
  if p_state<>'accepted' then
    update public.learning_email_center_drafts set status='needs_review',updated_at=now() where id=p_id;
  else
    select case when document->>'mode'='marketing' then 1 else (select count(*)::int from public.learning_email_center_targets where draft_id=p_id) end into v_expected from public.learning_email_center_drafts where id=p_id;
    select count(*)::int into v_accepted from public.learning_email_center_attempts where draft_id=p_id and state='accepted';
    update public.learning_email_center_drafts set status=case when v_accepted=v_expected then 'accepted' else 'sending' end,updated_at=now() where id=p_id and status<>'needs_review';
  end if;
end $$;
revoke all on function public.learning_email_center_check_operator(uuid), public.save_learning_email_center_draft(uuid,uuid,integer,jsonb), public.review_learning_email_center_draft(uuid,uuid,integer),public.claim_learning_email_center_attempt(uuid,uuid,integer,text),public.complete_learning_email_center_attempt(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.learning_email_center_check_operator(uuid), public.save_learning_email_center_draft(uuid,uuid,integer,jsonb), public.review_learning_email_center_draft(uuid,uuid,integer),public.claim_learning_email_center_attempt(uuid,uuid,integer,text),public.complete_learning_email_center_attempt(uuid,uuid,text,text,text) to service_role;
commit;
