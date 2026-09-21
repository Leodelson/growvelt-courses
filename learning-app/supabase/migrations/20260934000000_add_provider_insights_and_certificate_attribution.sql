-- Phase 2B4: owner-only provider reporting and certificate attribution.
-- Provider reporting is aggregate-only. It does not create provider earnings,
-- payout rights, or visibility into an individual instructor's earnings ledger.

begin;

alter table public.certificates
  add column provider_organization_id bigint references public.learning_provider_organizations(id) on delete restrict,
  add column provider_name text,
  add column provider_slug text,
  add column provider_was_verified boolean not null default false;

alter table public.certificates
  add constraint certificates_provider_snapshot_check check (
    (provider_organization_id is null and provider_name is null and provider_slug is null and provider_was_verified = false)
    or (provider_organization_id is not null and provider_name is not null and provider_slug is not null)
  );

create index certificates_course_issued_at_idx on public.certificates(course_id, issued_at desc, id desc);
create index enrollments_course_status_idx on public.enrollments(course_id, status, enrolled_at desc, id desc);
create index learning_commercial_allocations_course_idx on public.learning_commercial_allocations(course_id, allocated_at desc, id desc);

-- Existing organization-course certificates predate this phase. Attribute them
-- from their immutable course relationship so the provider record is complete.
update public.certificates certificate_row
set provider_organization_id = organization.id,
    provider_name = organization.name,
    provider_slug = organization.slug,
    provider_was_verified = coalesce(verification.status = 'verified', false)
from public.learning_courses course_row
join public.learning_provider_organizations organization on organization.id = course_row.organization_id
left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
where certificate_row.course_id = course_row.id
  and certificate_row.provider_organization_id is null;

create or replace function public.issue_own_learning_certificate(p_course_id bigint)
returns table(certificate_code text,certificate_status text,issued_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare state_row record; own_enrollment_id bigint; generated_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select enrollment_row.id into own_enrollment_id
  from public.enrollments enrollment_row
  join public.learning_courses course_row on course_row.id=enrollment_row.course_id and course_row.status='published'
  where enrollment_row.learner_id=auth.uid() and enrollment_row.course_id=p_course_id and enrollment_row.status='completed' and enrollment_row.completed_at is not null
  for update of enrollment_row,course_row;
  if own_enrollment_id is null then raise exception 'This course is not eligible for a certificate' using errcode='42501'; end if;
  select * into state_row from public.get_own_learning_certificate_state(p_course_id);
  if not coalesce(state_row.is_eligible,false) then raise exception 'This course is not eligible for a certificate' using errcode='22023'; end if;
  generated_code:=upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.certificates(
    learner_id,course_id,certificate_code,learner_name,course_title,instructor_name,completed_at,status,
    provider_organization_id,provider_name,provider_slug,provider_was_verified
  )
  select auth.uid(),course_row.id,generated_code,learner_profile.full_name,course_row.title,instructor_profile.full_name,enrollment_row.completed_at,'issued',
    organization.id,organization.name,organization.slug,coalesce(verification.status='verified',false)
  from public.learning_courses course_row
  join public.enrollments enrollment_row on enrollment_row.id=own_enrollment_id
  left join public.profiles learner_profile on learner_profile.id=auth.uid()
  left join public.profiles instructor_profile on instructor_profile.id=course_row.instructor_id
  left join public.learning_provider_organizations organization on organization.id=course_row.organization_id
  left join public.learning_provider_organization_verifications verification on verification.organization_id=organization.id
  where course_row.id=p_course_id and learner_profile.full_name is not null
  on conflict(learner_id,course_id) do nothing;
  return query select certificate_row.certificate_code,certificate_row.status,certificate_row.issued_at
  from public.certificates certificate_row where certificate_row.learner_id=auth.uid() and certificate_row.course_id=p_course_id;
end;
$function$;

drop function if exists public.list_own_learning_certificates();
create function public.list_own_learning_certificates()
returns table(certificate_code text,course_title text,learner_name text,instructor_name text,provider_name text,provider_slug text,provider_verified boolean,completed_at timestamptz,issued_at timestamptz,certificate_status text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return query select certificate_row.certificate_code,certificate_row.course_title,certificate_row.learner_name,certificate_row.instructor_name,
    certificate_row.provider_name,certificate_row.provider_slug,certificate_row.provider_was_verified,
    certificate_row.completed_at,certificate_row.issued_at,certificate_row.status
  from public.certificates certificate_row where certificate_row.learner_id=auth.uid() order by certificate_row.issued_at desc;
end;
$function$;

drop function if exists public.get_own_learning_certificate(text);
create function public.get_own_learning_certificate(p_certificate_code text)
returns table(certificate_code text,course_title text,learner_name text,instructor_name text,provider_name text,provider_slug text,provider_verified boolean,completed_at timestamptz,issued_at timestamptz,certificate_status text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return query select certificate_row.certificate_code,certificate_row.course_title,certificate_row.learner_name,certificate_row.instructor_name,
    certificate_row.provider_name,certificate_row.provider_slug,certificate_row.provider_was_verified,
    certificate_row.completed_at,certificate_row.issued_at,certificate_row.status
  from public.certificates certificate_row
  where certificate_row.learner_id=auth.uid() and certificate_row.certificate_code=upper(btrim(p_certificate_code));
end;
$function$;

drop function if exists public.verify_learning_certificate(text);
create function public.verify_learning_certificate(p_certificate_code text)
returns table(is_valid boolean,certificate_code text,learner_name text,course_title text,provider_name text,provider_slug text,provider_verified boolean,completed_at timestamptz,issued_at timestamptz,certificate_status text)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_code text:=upper(btrim(p_certificate_code));
begin
  if normalized_code is null or normalized_code !~ '^[A-F0-9]{32}$' then return; end if;
  return query select certificate_row.status='issued',certificate_row.certificate_code,certificate_row.learner_name,certificate_row.course_title,
    certificate_row.provider_name,certificate_row.provider_slug,certificate_row.provider_was_verified,
    certificate_row.completed_at,certificate_row.issued_at,certificate_row.status
  from public.certificates certificate_row where certificate_row.certificate_code=normalized_code;
end;
$function$;

create function public.get_own_learning_provider_organization_insights(p_organization_id bigint)
returns table(
  course_id bigint, course_title text, course_status text,
  enrolled_learner_count integer, active_learner_count integer, completed_learner_count integer, completion_rate integer,
  issued_certificate_count integer, revoked_certificate_count integer,
  paid_order_count integer, reversed_order_count integer,
  gross_sales_minor bigint, platform_commission_minor bigint, instructor_allocation_minor bigint,
  last_enrolled_at timestamptz, last_sale_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or p_organization_id is null or not exists (
    select 1 from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id=membership.organization_id
    where membership.organization_id=p_organization_id and membership.user_id=auth.uid()
      and membership.role='owner' and membership.status='active' and organization.status='active'
  ) then raise exception 'Active organization owner required' using errcode='42501'; end if;

  return query
  with organization_courses as (
    select course_row.id,course_row.title,course_row.status
    from public.learning_courses course_row where course_row.organization_id=p_organization_id
  ), enrollment_metrics as (
    select enrollment_row.course_id,
      count(*) filter(where enrollment_row.status in ('active','completed'))::integer as enrolled_count,
      count(*) filter(where enrollment_row.status='active')::integer as active_count,
      count(*) filter(where enrollment_row.status='completed')::integer as completed_count,
      max(enrollment_row.enrolled_at) filter(where enrollment_row.status in ('active','completed')) as latest_enrollment
    from public.enrollments enrollment_row join organization_courses course_row on course_row.id=enrollment_row.course_id
    group by enrollment_row.course_id
  ), certificate_metrics as (
    select certificate_row.course_id,
      count(*) filter(where certificate_row.status='issued')::integer as issued_count,
      count(*) filter(where certificate_row.status='revoked')::integer as revoked_count
    from public.certificates certificate_row join organization_courses course_row on course_row.id=certificate_row.course_id
    group by certificate_row.course_id
  ), commercial_metrics as (
    select allocation.course_id,
      count(*) filter(where allocation.status='allocated')::integer as paid_count,
      count(*) filter(where allocation.status='reversed')::integer as reversed_count,
      coalesce(sum(allocation.gross_amount_minor) filter(where allocation.status='allocated'),0)::bigint as gross_sales,
      coalesce(sum(allocation.platform_commission_minor) filter(where allocation.status='allocated'),0)::bigint as platform_commission,
      coalesce(sum(allocation.instructor_gross_minor) filter(where allocation.status='allocated'),0)::bigint as instructor_allocation,
      max(allocation.allocated_at) filter(where allocation.status='allocated') as latest_sale
    from public.learning_commercial_allocations allocation join organization_courses course_row on course_row.id=allocation.course_id
    group by allocation.course_id
  )
  select course_row.id,course_row.title,course_row.status,
    coalesce(enrollment_row.enrolled_count,0),coalesce(enrollment_row.active_count,0),coalesce(enrollment_row.completed_count,0),
    case when coalesce(enrollment_row.enrolled_count,0)=0 then 0 else round((enrollment_row.completed_count::numeric/enrollment_row.enrolled_count::numeric)*100)::integer end,
    coalesce(certificate_row.issued_count,0),coalesce(certificate_row.revoked_count,0),
    coalesce(commercial_row.paid_count,0),coalesce(commercial_row.reversed_count,0),
    coalesce(commercial_row.gross_sales,0),coalesce(commercial_row.platform_commission,0),coalesce(commercial_row.instructor_allocation,0),
    enrollment_row.latest_enrollment,commercial_row.latest_sale
  from organization_courses course_row
  left join enrollment_metrics enrollment_row on enrollment_row.course_id=course_row.id
  left join certificate_metrics certificate_row on certificate_row.course_id=course_row.id
  left join commercial_metrics commercial_row on commercial_row.course_id=course_row.id
  order by course_row.title asc,course_row.id asc;
end;
$function$;

revoke all on function public.issue_own_learning_certificate(bigint),public.list_own_learning_certificates(),public.get_own_learning_certificate(text),public.verify_learning_certificate(text),public.get_own_learning_provider_organization_insights(bigint) from public,anon,authenticated;
grant execute on function public.issue_own_learning_certificate(bigint),public.list_own_learning_certificates(),public.get_own_learning_certificate(text),public.get_own_learning_provider_organization_insights(bigint) to authenticated,postgres,service_role;
grant execute on function public.verify_learning_certificate(text) to anon,authenticated,postgres,service_role;

commit;
