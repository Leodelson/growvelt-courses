-- Phase 4: guarded Live plan setup for approved instructors.
-- This does not start learner billing or enable subscription checkout.
begin;

alter table public.learning_subscription_plan_provisioning
  add column payment_domain text not null default 'test';
alter table public.learning_subscription_plan_provisioning
  add constraint learning_subscription_plan_provisioning_domain_check
  check (payment_domain in ('test','live'));

-- One browser submission request maps to exactly one plan and provider claim.
-- The provider create endpoint does not support an application idempotency key,
-- so an uncertain result must remain locked for reconciliation.
create table public.learning_live_subscription_plan_requests (
  request_id uuid primary key,
  instructor_id uuid not null,
  plan_id uuid not null unique,
  plan_name text not null,
  plan_description text,
  amount_minor bigint not null check (amount_minor > 0),
  course_ids bigint[] not null check (cardinality(course_ids) between 1 and 50),
  created_at timestamptz not null default now(),
  constraint learning_live_subscription_plan_requests_plan_fkey
    foreign key (plan_id,instructor_id)
    references public.learning_subscription_plans(id,instructor_id) on delete restrict
);
alter table public.learning_live_subscription_plan_requests enable row level security;
revoke all on public.learning_live_subscription_plan_requests from public,anon,authenticated,service_role;

-- Only the trusted server action (service_role) can begin Live provider setup.
-- This keeps the application environment gate authoritative and makes retries
-- with the same request id return the prior plan rather than creating a second.
create or replace function public.begin_own_learning_live_subscription_plan(
  p_request_id uuid,p_instructor_id uuid,p_name text,p_description text,p_amount_minor bigint,p_course_ids bigint[]
) returns table(provisioning_state text,plan_id uuid,provisioning_id uuid,plan_name text,
  plan_description text,amount_minor bigint,existing_plan_code text,attempt_count integer)
language plpgsql security definer set search_path to '' as $function$
declare
  actor_id uuid:=p_instructor_id;
  normalized_name text:=btrim(coalesce(p_name,''));
  normalized_description text:=nullif(btrim(coalesce(p_description,'')), '');
  normalized_course_ids bigint[];
  request_row public.learning_live_subscription_plan_requests%rowtype;
  plan_row public.learning_subscription_plans%rowtype;
  provision_row public.learning_subscription_plan_provisioning%rowtype;
  requested_count integer;
  eligible_count integer;
  terms_count integer;
  resolved_terms_version text;
  created_plan_id uuid;
begin
  if p_request_id is null or actor_id is null or not exists (
    select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor on instructor.user_id=capability.user_id
    where capability.user_id=actor_id and capability.capability='instructor'
      and capability.status='active' and instructor.approval_status='approved'
  ) then
    raise exception 'Approved Instructor capability and request id required' using errcode='42501';
  end if;
  if char_length(normalized_name) not between 3 and 100
    or (normalized_description is not null and char_length(normalized_description)>1000)
    or p_amount_minor is null or p_amount_minor<=0 then
    raise exception 'Provide a valid plan name, description, and positive NGN price' using errcode='22023';
  end if;
  if p_course_ids is null or cardinality(p_course_ids) not between 1 and 50
    or exists(select 1 from unnest(p_course_ids) selected(course_id) where course_id is null) then
    raise exception 'Select between 1 and 50 valid courses for the plan' using errcode='22023';
  end if;
  requested_count:=cardinality(p_course_ids);
  if requested_count<>(select count(distinct course_id)::integer from unnest(p_course_ids) selected(course_id)) then
    raise exception 'Selected course IDs must be unique' using errcode='22023';
  end if;
  select array_agg(selected.course_id order by selected.course_id) into normalized_course_ids
    from unnest(p_course_ids) selected(course_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text||':'||p_request_id::text,0)
  );
  select * into request_row from public.learning_live_subscription_plan_requests request
    where request.request_id=p_request_id for update;
  if found then
    if request_row.instructor_id<>actor_id then
      raise exception 'Live plan request is unavailable' using errcode='42501';
    end if;
    if request_row.plan_name<>normalized_name
      or request_row.plan_description is distinct from normalized_description
      or request_row.amount_minor<>p_amount_minor
      or request_row.course_ids<>normalized_course_ids then
      raise exception 'Request id cannot be reused with different plan details' using errcode='23505';
    end if;
    select * into plan_row from public.learning_subscription_plans plan
      where plan.id=request_row.plan_id and plan.instructor_id=actor_id for update;
    if not found then raise exception 'Live plan request is unavailable' using errcode='42501'; end if;
    select * into provision_row from public.learning_subscription_plan_provisioning item
      where item.plan_id=request_row.plan_id and item.instructor_id=actor_id for update;
    if not found or provision_row.payment_domain<>'live' then
      raise exception 'Live plan request needs reconciliation' using errcode='23514';
    end if;
    if provision_row.state='claimed' and provision_row.claimed_at<now()-interval '5 minutes' then
      update public.learning_subscription_plan_provisioning item
        set state='needs_reconciliation',failure_code='provider_response_unconfirmed',completed_at=now(),updated_at=now()
        where item.plan_id=request_row.plan_id returning * into provision_row;
    elsif provision_row.state='failed' then
      update public.learning_subscription_plan_provisioning item
        set state='claimed',attempt_count=item.attempt_count+1,claimed_at=now(),updated_at=now(),
          completed_at=null,failure_code=null where item.plan_id=request_row.plan_id returning * into provision_row;
      return query select 'claimed',request_row.plan_id,provision_row.id,plan_row.name,plan_row.description,
        plan_row.amount_minor,null::text,provision_row.attempt_count;
      return;
    end if;
    return query select case when provision_row.state='claimed' then 'in_progress' else provision_row.state end,
      request_row.plan_id,provision_row.id,plan_row.name,plan_row.description,plan_row.amount_minor,
      provision_row.paystack_plan_code,provision_row.attempt_count;
    return;
  end if;

  select count(*)::integer,count(distinct terms.version)::integer,min(terms.version)
    into eligible_count,terms_count,resolved_terms_version
  from unnest(normalized_course_ids) selected(course_id)
  join public.learning_courses course on course.id=selected.course_id
  cross join lateral (select public.resolve_learning_commercial_terms_version(course.id,course.instructor_id) version) terms
  where course.instructor_id=actor_id and course.organization_id is null and course.status='published'
    and not course.is_free and not coalesce(course.is_limited_time_free,false)
    and course.price_currency='NGN' and course.price_amount>0
    and not coalesce(course.company_test_mode_only,false)
    and not public.is_paystack_test_fixture_course(course.id);
  if eligible_count<>requested_count then
    raise exception 'Every selected course must be your published public paid NGN course' using errcode='42501';
  end if;
  if terms_count<>1 or resolved_terms_version is null then
    raise exception 'All courses in one plan must use the same active commercial terms' using errcode='23514';
  end if;
  if not exists(select 1 from public.learning_commercial_terms terms
    where terms.version=resolved_terms_version and terms.active and terms.effective_at<=now() and terms.retired_at is null
      and ((terms.scope_type='platform' and terms.instructor_id is null)
        or (terms.scope_type='instructor' and terms.instructor_id=actor_id))) then
    raise exception 'Subscription plan commercial terms are no longer active' using errcode='23514';
  end if;

  insert into public.learning_subscription_plans(
    instructor_id,name,description,amount_minor,commercial_terms_version,payment_domain,status
  ) values(actor_id,normalized_name,normalized_description,p_amount_minor,resolved_terms_version,'live','draft')
    returning id into created_plan_id;
  insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
    select created_plan_id,actor_id,selected.course_id from unnest(normalized_course_ids) selected(course_id);
  insert into public.learning_subscription_plan_provisioning(plan_id,instructor_id,payment_domain)
    values(created_plan_id,actor_id,'live') returning * into provision_row;
  insert into public.learning_live_subscription_plan_requests(
    request_id,instructor_id,plan_id,plan_name,plan_description,amount_minor,course_ids
  ) values(p_request_id,actor_id,created_plan_id,normalized_name,normalized_description,p_amount_minor,normalized_course_ids);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(actor_id,'instructor','subscription_plan.live_draft_created','learning_subscription_plan',created_plan_id::text,
      jsonb_build_object('course_ids',to_jsonb(normalized_course_ids),'amount_minor',p_amount_minor,'currency','NGN',
        'billing_interval','monthly','commercial_terms_version',resolved_terms_version,'payment_domain','live'));
  return query select 'claimed',created_plan_id,provision_row.id,normalized_name,normalized_description,
    p_amount_minor,null::text,provision_row.attempt_count;
end;$function$;

revoke all on function public.begin_own_learning_live_subscription_plan(uuid,uuid,text,text,bigint,bigint[])
  from public,anon,authenticated;
grant execute on function public.begin_own_learning_live_subscription_plan(uuid,uuid,text,text,bigint,bigint[])
  to service_role,postgres;

create or replace function public.create_own_learning_live_subscription_plan(
  p_name text,p_description text,p_amount_minor bigint,p_course_ids bigint[]
) returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  actor_id uuid := auth.uid();
  normalized_name text := btrim(coalesce(p_name,''));
  normalized_description text := nullif(btrim(coalesce(p_description,'')),'');
  requested_count integer;
  eligible_count integer;
  terms_count integer;
  resolved_terms_version text;
  created_plan_id uuid;
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode='42501';
  end if;
  if char_length(normalized_name) not between 3 and 100
    or (normalized_description is not null and char_length(normalized_description)>1000)
    or p_amount_minor is null or p_amount_minor<=0 then
    raise exception 'Provide a valid plan name, description, and positive NGN price' using errcode='22023';
  end if;
  if p_course_ids is null or cardinality(p_course_ids) not between 1 and 50 then
    raise exception 'Select between 1 and 50 courses for the plan' using errcode='22023';
  end if;
  requested_count:=cardinality(p_course_ids);
  if requested_count<>(select count(distinct course_id)::integer from unnest(p_course_ids) selected(course_id))
    or exists(select 1 from unnest(p_course_ids) selected(course_id) where course_id is null) then
    raise exception 'Selected course IDs must be unique and non-null' using errcode='22023';
  end if;
  select count(*)::integer,count(distinct terms.version)::integer,min(terms.version)
    into eligible_count,terms_count,resolved_terms_version
  from unnest(p_course_ids) selected(course_id)
  join public.learning_courses course on course.id=selected.course_id
  cross join lateral (select public.resolve_learning_commercial_terms_version(course.id,course.instructor_id) version) terms
  where course.instructor_id=actor_id and course.organization_id is null and course.status='published'
    and not course.is_free and not coalesce(course.is_limited_time_free,false)
    and course.price_currency='NGN' and course.price_amount>0
    and not coalesce(course.company_test_mode_only,false)
    and not public.is_paystack_test_fixture_course(course.id);
  if eligible_count<>requested_count then
    raise exception 'Every selected course must be your published public paid NGN course' using errcode='42501';
  end if;
  if terms_count<>1 or resolved_terms_version is null then
    raise exception 'All courses in one plan must use the same active commercial terms' using errcode='23514';
  end if;
  insert into public.learning_subscription_plans(
    instructor_id,name,description,amount_minor,commercial_terms_version,payment_domain,status
  ) values(actor_id,normalized_name,normalized_description,p_amount_minor,resolved_terms_version,'live','draft')
    returning id into created_plan_id;
  insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
    select created_plan_id,actor_id,selected.course_id from unnest(p_course_ids) selected(course_id);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(actor_id,'instructor','subscription_plan.live_draft_created','learning_subscription_plan',created_plan_id::text,
    jsonb_build_object('course_ids',to_jsonb(p_course_ids),'amount_minor',p_amount_minor,'currency','NGN',
      'billing_interval','monthly','commercial_terms_version',resolved_terms_version,'payment_domain','live'));
  return created_plan_id;
end;$function$;

create or replace function public.claim_own_learning_live_subscription_plan_provisioning(p_plan_id uuid)
returns table(provisioning_state text,provisioning_id uuid,plan_name text,plan_description text,
  amount_minor bigint,existing_plan_code text,attempt_count integer)
language plpgsql security definer set search_path to '' as $function$
declare
  actor_id uuid:=auth.uid();
  plan_row public.learning_subscription_plans%rowtype;
  provision_row public.learning_subscription_plan_provisioning%rowtype;
  new_id uuid;
  acquired boolean:=false;
  eligible_count integer;
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode='42501';
  end if;
  select * into plan_row from public.learning_subscription_plans plan
    where plan.id=p_plan_id and plan.instructor_id=actor_id for update;
  if not found then raise exception 'Subscription plan is unavailable' using errcode='42501'; end if;
  if plan_row.status='active' and plan_row.payment_domain='live' and plan_row.paystack_plan_code is not null then
    select * into provision_row from public.learning_subscription_plan_provisioning item
      where item.plan_id=p_plan_id and item.instructor_id=actor_id for update;
    if not found or provision_row.payment_domain<>'live' or provision_row.state<>'recorded'
      or provision_row.paystack_plan_code<>plan_row.paystack_plan_code then
      raise exception 'Live plan provisioning needs reconciliation' using errcode='23514';
    end if;
    return query select 'recorded',provision_row.id,plan_row.name,plan_row.description,
      plan_row.amount_minor,plan_row.paystack_plan_code,provision_row.attempt_count;
    return;
  end if;
  if plan_row.status<>'draft' or plan_row.payment_domain<>'live' or plan_row.paystack_plan_code is not null then
    raise exception 'Only an unprovisioned Live draft can be submitted' using errcode='23514';
  end if;
  select count(*)::integer into eligible_count
  from public.learning_subscription_plan_courses item join public.learning_courses course on course.id=item.course_id
  where item.plan_id=p_plan_id and item.instructor_id=actor_id and course.instructor_id=actor_id
    and course.organization_id is null and course.status='published' and not course.is_free
    and not coalesce(course.is_limited_time_free,false) and course.price_currency='NGN'
    and course.price_amount>0 and not coalesce(course.company_test_mode_only,false)
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id,actor_id)=plan_row.commercial_terms_version;
  if eligible_count=0 or eligible_count<>(select count(*)::integer from public.learning_subscription_plan_courses item where item.plan_id=p_plan_id)
    or not exists(select 1 from public.learning_commercial_terms terms where terms.version=plan_row.commercial_terms_version
      and terms.active and terms.effective_at<=now() and terms.retired_at is null
      and ((terms.scope_type='platform' and terms.instructor_id is null)
        or (terms.scope_type='instructor' and terms.instructor_id=actor_id))) then
    raise exception 'Plan courses or commercial terms are no longer eligible' using errcode='23514';
  end if;
  insert into public.learning_subscription_plan_provisioning(plan_id,instructor_id,payment_domain)
    values(p_plan_id,actor_id,'live') on conflict(plan_id) do nothing returning id into new_id;
  acquired:=new_id is not null;
  select * into provision_row from public.learning_subscription_plan_provisioning item
    where item.plan_id=p_plan_id and item.instructor_id=actor_id for update;
  if provision_row.payment_domain<>'live' then
    raise exception 'This plan already has a provider setup in another domain' using errcode='23514';
  end if;
  if provision_row.state='claimed' and provision_row.claimed_at<now()-interval '5 minutes' then
    update public.learning_subscription_plan_provisioning item
      set state='needs_reconciliation',failure_code='provider_response_unconfirmed',completed_at=now(),updated_at=now()
      where item.plan_id=p_plan_id returning * into provision_row;
  elsif provision_row.state='failed' then
    update public.learning_subscription_plan_provisioning item
      set state='claimed',attempt_count=item.attempt_count+1,claimed_at=now(),updated_at=now(),
        completed_at=null,failure_code=null where item.plan_id=p_plan_id returning * into provision_row;
    acquired:=true;
  end if;
  if provision_row.state='claimed' and acquired then
    return query select 'claimed',provision_row.id,plan_row.name,plan_row.description,plan_row.amount_minor,null::text,provision_row.attempt_count;
  elsif provision_row.state='claimed' then
    return query select 'in_progress',provision_row.id,plan_row.name,plan_row.description,plan_row.amount_minor,null::text,provision_row.attempt_count;
  else
    return query select provision_row.state,provision_row.id,plan_row.name,plan_row.description,
      plan_row.amount_minor,provision_row.paystack_plan_code,provision_row.attempt_count;
  end if;
end;$function$;

create or replace function public.record_own_learning_live_subscription_plan_provisioning(
  p_plan_id uuid,p_instructor_id uuid,p_paystack_plan_code text
) returns text language plpgsql security definer set search_path to '' as $function$
declare
  plan_row public.learning_subscription_plans%rowtype;
  provision_row public.learning_subscription_plan_provisioning%rowtype;
begin
  if p_instructor_id is null or not exists(select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor on instructor.user_id=capability.user_id
    where capability.user_id=p_instructor_id and capability.capability='instructor'
      and capability.status='active' and instructor.approval_status='approved') then
    raise exception 'Approved Instructor capability required' using errcode='42501';
  end if;
  if p_paystack_plan_code is null or p_paystack_plan_code !~ '^PLN_[A-Za-z0-9]{8,100}$' then
    raise exception 'Paystack plan code is invalid' using errcode='22023';
  end if;
  select * into plan_row from public.learning_subscription_plans plan
    where plan.id=p_plan_id and plan.instructor_id=p_instructor_id for update;
  if not found then raise exception 'Subscription plan is unavailable' using errcode='42501'; end if;
  select * into provision_row from public.learning_subscription_plan_provisioning item
    where item.plan_id=p_plan_id and item.instructor_id=p_instructor_id for update;
  if not found or provision_row.payment_domain<>'live' then
    raise exception 'Live provisioning claim is unavailable' using errcode='42501';
  end if;
  if provision_row.state='recorded' then
    if provision_row.paystack_plan_code<>p_paystack_plan_code or plan_row.paystack_plan_code<>p_paystack_plan_code then
      raise exception 'Recorded Live plan code cannot be replaced' using errcode='42501';
    end if;
    return 'recorded';
  end if;
  if provision_row.state<>'claimed' or plan_row.status<>'draft' or plan_row.payment_domain<>'live'
    or plan_row.paystack_plan_code is not null then
    raise exception 'Live plan is no longer eligible for provisioning' using errcode='23514';
  end if;
  update public.learning_subscription_plans set paystack_plan_code=p_paystack_plan_code,status='active' where id=p_plan_id;
  update public.learning_subscription_plan_provisioning set state='recorded',paystack_plan_code=p_paystack_plan_code,
    completed_at=now(),updated_at=now(),failure_code=null where plan_id=p_plan_id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_instructor_id,'instructor','subscription_plan.live_provider_plan_recorded','learning_subscription_plan',p_plan_id::text,
      jsonb_build_object('payment_domain','live','billing_interval','monthly','amount_minor',plan_row.amount_minor));
  return 'recorded';
end;$function$;

create or replace function public.finish_own_learning_live_subscription_plan_provisioning(
  p_plan_id uuid,p_instructor_id uuid,p_outcome text
) returns text language plpgsql security definer set search_path to '' as $function$
declare provision_row public.learning_subscription_plan_provisioning%rowtype; next_state text; next_failure text;
begin
  if p_instructor_id is null or not exists(select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor on instructor.user_id=capability.user_id
    where capability.user_id=p_instructor_id and capability.capability='instructor'
      and capability.status='active' and instructor.approval_status='approved') then
    raise exception 'Approved Instructor capability required' using errcode='42501';
  end if;
  if p_outcome not in ('provider_rejected','ambiguous') then raise exception 'Invalid setup outcome' using errcode='22023'; end if;
  select * into provision_row from public.learning_subscription_plan_provisioning item
    where item.plan_id=p_plan_id and item.instructor_id=p_instructor_id for update;
  if not found or provision_row.payment_domain<>'live' then raise exception 'Live provisioning claim is unavailable' using errcode='42501'; end if;
  if provision_row.state<>'claimed' then return provision_row.state; end if;
  next_state:=case when p_outcome='provider_rejected' then 'failed' else 'needs_reconciliation' end;
  next_failure:=case when p_outcome='provider_rejected' then 'provider_rejected' else 'provider_response_unconfirmed' end;
  update public.learning_subscription_plan_provisioning set state=next_state,failure_code=next_failure,
    completed_at=now(),updated_at=now() where plan_id=p_plan_id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_instructor_id,'instructor','subscription_plan.live_provider_plan_'||next_state,
      'learning_subscription_plan',p_plan_id::text,jsonb_build_object('payment_domain','live','failure_code',next_failure));
  return next_state;
end;$function$;

create or replace function public.list_own_learning_live_subscription_plan_ids()
returns table(plan_id uuid,provisioning_state text,attempt_count integer,payment_domain text)
language plpgsql stable security definer set search_path to '' as $function$
declare actor_id uuid:=auth.uid();
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode='42501';
  end if;
  return query select item.plan_id,item.state,item.attempt_count,item.payment_domain from public.learning_subscription_plan_provisioning item
    where item.instructor_id=actor_id and item.payment_domain='live';
end;$function$;

revoke all on function public.create_own_learning_live_subscription_plan(text,text,bigint,bigint[]),
  public.claim_own_learning_live_subscription_plan_provisioning(uuid),
  public.record_own_learning_live_subscription_plan_provisioning(uuid,uuid,text),
  public.finish_own_learning_live_subscription_plan_provisioning(uuid,uuid,text),
  public.list_own_learning_live_subscription_plan_ids() from public,anon;
revoke all on function public.create_own_learning_live_subscription_plan(text,text,bigint,bigint[]),
  public.claim_own_learning_live_subscription_plan_provisioning(uuid),
  public.list_own_learning_live_subscription_plan_ids() from authenticated,service_role;
revoke all on function public.record_own_learning_live_subscription_plan_provisioning(uuid,uuid,text),
  public.finish_own_learning_live_subscription_plan_provisioning(uuid,uuid,text) from authenticated;
grant execute on function public.list_own_learning_live_subscription_plan_ids() to authenticated,postgres;
grant execute on function public.record_own_learning_live_subscription_plan_provisioning(uuid,uuid,text),
  public.finish_own_learning_live_subscription_plan_provisioning(uuid,uuid,text) to postgres,service_role;

commit;
