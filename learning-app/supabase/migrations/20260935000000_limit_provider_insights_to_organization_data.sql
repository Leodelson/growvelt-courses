-- Phase 2B4 privacy correction: provider insights are organization reporting,
-- not a view into Growvelt economics or an instructor's personal allocations.
-- Every active organization member may read aggregate organization reporting.

begin;

drop function if exists public.get_own_learning_provider_organization_insights(bigint);

create function public.get_own_learning_provider_organization_insights(p_organization_id bigint)
returns table(
  course_id bigint, course_title text, course_status text,
  enrolled_learner_count integer, active_learner_count integer, completed_learner_count integer, completion_rate integer,
  issued_certificate_count integer, revoked_certificate_count integer,
  paid_order_count integer, reversed_order_count integer, gross_sales_minor bigint,
  last_enrolled_at timestamptz, last_sale_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or p_organization_id is null or not exists (
    select 1 from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id=membership.organization_id
    where membership.organization_id=p_organization_id and membership.user_id=auth.uid()
      and membership.status='active' and organization.status='active'
  ) then raise exception 'Active organization membership required' using errcode='42501'; end if;

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
      max(allocation.allocated_at) filter(where allocation.status='allocated') as latest_sale
    from public.learning_commercial_allocations allocation join organization_courses course_row on course_row.id=allocation.course_id
    group by allocation.course_id
  )
  select course_row.id,course_row.title,course_row.status,
    coalesce(enrollment_row.enrolled_count,0),coalesce(enrollment_row.active_count,0),coalesce(enrollment_row.completed_count,0),
    case when coalesce(enrollment_row.enrolled_count,0)=0 then 0 else round((enrollment_row.completed_count::numeric/enrollment_row.enrolled_count::numeric)*100)::integer end,
    coalesce(certificate_row.issued_count,0),coalesce(certificate_row.revoked_count,0),
    coalesce(commercial_row.paid_count,0),coalesce(commercial_row.reversed_count,0),coalesce(commercial_row.gross_sales,0),
    enrollment_row.latest_enrollment,commercial_row.latest_sale
  from organization_courses course_row
  left join enrollment_metrics enrollment_row on enrollment_row.course_id=course_row.id
  left join certificate_metrics certificate_row on certificate_row.course_id=course_row.id
  left join commercial_metrics commercial_row on commercial_row.course_id=course_row.id
  order by course_row.title asc,course_row.id asc;
end;
$function$;

revoke all on function public.get_own_learning_provider_organization_insights(bigint) from public,anon,authenticated;
grant execute on function public.get_own_learning_provider_organization_insights(bigint) to authenticated,postgres,service_role;

commit;
