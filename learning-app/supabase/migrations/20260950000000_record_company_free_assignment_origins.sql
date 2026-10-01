-- Preserve the free origin of a company assignment, including when a paid
-- purchase already created its shared assignment and enrollment rows.
-- This is provenance only; cancellation and access policy are unchanged.
begin;

create table public.learning_company_free_assignment_origins (
  assignment_id bigint primary key references public.learning_company_course_assignments(id) on delete restrict,
  enrollment_id bigint not null references public.enrollments(id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index learning_company_free_assignment_origins_enrollment_idx
  on public.learning_company_free_assignment_origins(enrollment_id);
alter table public.learning_company_free_assignment_origins enable row level security;
revoke all on public.learning_company_free_assignment_origins from public,anon,authenticated,service_role;
grant select on public.learning_company_free_assignment_origins to service_role;
create trigger prevent_learning_company_free_assignment_origin_mutation
before update or delete on public.learning_company_free_assignment_origins
for each row execute function public.prevent_learning_company_sale_mutation();

create or replace function public.assign_learning_company_course(
  p_workspace_id bigint,p_course_id bigint,p_assigned_user_id uuid)
returns table(assignment_id bigint,enrollment_id bigint,access_state text)
language plpgsql security definer set search_path to '' as $function$
declare assignment_key bigint; enrollment_key bigint;
  existing public.learning_company_course_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_workspace_id is null or p_course_id is null or p_assigned_user_id is null then
    raise exception 'Invalid company assignment' using errcode='22023';
  end if;
  if not exists(select 1 from public.learning_company_workspaces workspace
    join public.learning_company_memberships manager on manager.workspace_id=workspace.id
    where workspace.id=p_workspace_id and workspace.status='active'
      and manager.user_id=auth.uid() and manager.status='active'
      and manager.role in ('owner','admin')) then
    raise exception 'Active company manager required' using errcode='42501';
  end if;
  if not exists(select 1 from public.learning_company_memberships employee
    where employee.workspace_id=p_workspace_id and employee.user_id=p_assigned_user_id
      and employee.status='active') then
    raise exception 'Employee is not an active company member' using errcode='42501';
  end if;
  perform 1 from public.learning_courses course_row
  where course_row.id=p_course_id and course_row.status='published'
    and course_row.is_free=true and coalesce(course_row.price_amount,0)=0
    and coalesce(course_row.is_limited_time_free,false)=false for share;
  if not found then
    raise exception 'Only published free courses can be assigned until company billing is available' using errcode='22023';
  end if;
  -- Use the same learner/course lock as paid-seat grants and reversals.
  -- The already-assigned branch can otherwise record a free origin after
  -- a reversal has decided that no independent source exists.
  perform pg_advisory_xact_lock(hashtextextended('learning-company-paid-access:'||
    p_course_id::text||':'||p_assigned_user_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('learning-company-course-assignment:'||
    p_workspace_id::text||':'||p_course_id::text||':'||p_assigned_user_id::text,0));
  select * into existing from public.learning_company_course_assignments assignment_row
  where assignment_row.workspace_id=p_workspace_id and assignment_row.course_id=p_course_id
    and assignment_row.assigned_user_id=p_assigned_user_id and assignment_row.status='active'
  for update;
  if found then
    select enrollment.id into enrollment_key from public.enrollments enrollment
    where enrollment.learner_id=p_assigned_user_id and enrollment.course_id=p_course_id
      and enrollment.status in ('active','completed');
    if enrollment_key is not null then
      insert into public.learning_company_free_assignment_origins(assignment_id,enrollment_id)
      values(existing.id,enrollment_key)
      on conflict on constraint learning_company_free_assignment_origins_pkey do nothing;
    end if;
    return query select existing.id,enrollment_key,'already_assigned'::text;
    return;
  end if;
  insert into public.learning_company_course_assignments(
    workspace_id,course_id,assigned_user_id,assigned_by)
  values(p_workspace_id,p_course_id,p_assigned_user_id,auth.uid())
  returning id into assignment_key;
  insert into public.enrollments(learner_id,course_id,status)
  values(p_assigned_user_id,p_course_id,'active')
  on conflict(learner_id,course_id) do update
    set status='active',completed_at=null where public.enrollments.status='cancelled'
  returning id into enrollment_key;
  if enrollment_key is null then
    select enrollment.id into enrollment_key from public.enrollments enrollment
    where enrollment.learner_id=p_assigned_user_id and enrollment.course_id=p_course_id
      and enrollment.status in ('active','completed');
  end if;
  if enrollment_key is null then
    raise exception 'Free company enrollment was not granted' using errcode='23514';
  end if;
  insert into public.learning_company_free_assignment_origins(assignment_id,enrollment_id)
  values(assignment_key,enrollment_key);
  insert into public.learning_audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(auth.uid(),'company_manager','company_course.assigned',
    'learning_company_course_assignment',assignment_key::text,
    jsonb_build_object('workspace_id',p_workspace_id,'course_id',p_course_id,
      'assigned_user_id',p_assigned_user_id));
  return query select assignment_key,enrollment_key,'assigned'::text;
end;$function$;

revoke all on function public.assign_learning_company_course(bigint,bigint,uuid)
  from public,anon,authenticated;
grant execute on function public.assign_learning_company_course(bigint,bigint,uuid)
  to authenticated,postgres,service_role;

commit;
