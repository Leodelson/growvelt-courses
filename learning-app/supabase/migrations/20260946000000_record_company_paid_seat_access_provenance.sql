-- Phase 3C: identify the exact paid purchase behind each company seat grant.
-- This is provenance only. It does not revoke access or process refunds.
-- Existing paid Test Mode purchases remain unlinked until reviewed; never
-- infer an old seat's origin from a shared enrollment or assignment alone.
-- Forward-fix rollback: restore the previous grant function in a reviewed
-- migration; retain provenance rows for audit and do not delete them.
begin;

create table public.learning_company_paid_seat_access (
  purchase_id bigint not null,
  assigned_user_id uuid not null,
  assignment_id bigint not null references public.learning_company_course_assignments(id) on delete restrict,
  enrollment_id bigint not null references public.enrollments(id) on delete restrict,
  assignment_was_active_before_purchase boolean not null,
  enrollment_was_active_before_purchase boolean not null,
  status text not null default 'active' check (status in ('active','refunded','chargeback')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(purchase_id,assigned_user_id),
  foreign key(purchase_id,assigned_user_id)
    references public.learning_company_paid_course_purchase_seats(purchase_id,assigned_user_id) on delete restrict,
  constraint learning_company_paid_seat_access_lifecycle_check check (
    (status = 'active' and revoked_at is null)
    or (status in ('refunded','chargeback') and revoked_at is not null))
);
create index learning_company_paid_seat_access_assignment_idx
  on public.learning_company_paid_seat_access(assignment_id,status);
create index learning_company_paid_seat_access_enrollment_idx
  on public.learning_company_paid_seat_access(enrollment_id,status);

alter table public.learning_company_paid_seat_access enable row level security;
revoke all on public.learning_company_paid_seat_access from public,anon,authenticated,service_role;
grant select on public.learning_company_paid_seat_access to service_role;

create or replace function public.protect_learning_company_paid_seat_access()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Company paid seat provenance cannot be deleted' using errcode = '42501';
  end if;
  if old.purchase_id is distinct from new.purchase_id
     or old.assigned_user_id is distinct from new.assigned_user_id
     or old.assignment_id is distinct from new.assignment_id
     or old.enrollment_id is distinct from new.enrollment_id
     or old.assignment_was_active_before_purchase is distinct from new.assignment_was_active_before_purchase
     or old.enrollment_was_active_before_purchase is distinct from new.enrollment_was_active_before_purchase
     or old.granted_at is distinct from new.granted_at
     or old.status <> 'active' or new.status not in ('refunded','chargeback')
     or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'Company paid seat provenance is immutable except verified revocation' using errcode = '42501';
  end if;
  return new;
end;$function$;
create trigger protect_learning_company_paid_seat_access
before update or delete on public.learning_company_paid_seat_access
for each row execute function public.protect_learning_company_paid_seat_access();

create or replace function public.grant_paid_learning_company_purchase_access(p_purchase_id bigint)
returns table(granted_seat_count integer)
language plpgsql security definer set search_path to '' as $function$
declare purchase_row public.learning_company_paid_course_purchases%rowtype;
  seat_row record; existing_access public.learning_company_paid_seat_access%rowtype;
  enrollment_key bigint; assignment_key bigint; prior_enrollment boolean; prior_assignment boolean;
  granted_count integer := 0;
begin
  if p_purchase_id is null then raise exception 'Invalid company purchase' using errcode = '22023'; end if;
  select * into purchase_row from public.learning_company_paid_course_purchases purchase
  where purchase.id = p_purchase_id and purchase.status = 'paid' for update;
  if not found then raise exception 'Paid company purchase required before granting access' using errcode = '22023'; end if;
  for seat_row in select seat.assigned_user_id from public.learning_company_paid_course_purchase_seats seat
    where seat.purchase_id = purchase_row.id order by seat.assigned_user_id loop
    perform pg_advisory_xact_lock(hashtextextended('learning-company-paid-access:' ||
      purchase_row.course_id::text || ':' || seat_row.assigned_user_id::text, 0));
    select * into existing_access from public.learning_company_paid_seat_access access_row
    where access_row.purchase_id = purchase_row.id and access_row.assigned_user_id = seat_row.assigned_user_id for update;
    if found then
      if existing_access.status <> 'active' then
        raise exception 'A reversed company seat cannot be granted again' using errcode = '42501';
      end if;
      granted_count := granted_count + 1;
      continue;
    end if;
    select exists(select 1 from public.enrollments enrollment
      where enrollment.learner_id = seat_row.assigned_user_id and enrollment.course_id = purchase_row.course_id
        and enrollment.status in ('active','completed')) into prior_enrollment;
    select exists(select 1 from public.learning_company_course_assignments assignment
      where assignment.workspace_id = purchase_row.workspace_id and assignment.course_id = purchase_row.course_id
        and assignment.assigned_user_id = seat_row.assigned_user_id and assignment.status = 'active') into prior_assignment;
    insert into public.enrollments(learner_id,course_id,status)
    values(seat_row.assigned_user_id,purchase_row.course_id,'active')
    on conflict(learner_id,course_id) do update set status = 'active',completed_at = null
      where public.enrollments.status = 'cancelled';
    select enrollment.id into enrollment_key from public.enrollments enrollment
    where enrollment.learner_id = seat_row.assigned_user_id and enrollment.course_id = purchase_row.course_id
      and enrollment.status in ('active','completed');
    if enrollment_key is null then raise exception 'Paid company enrollment was not granted' using errcode = '23514'; end if;
    insert into public.learning_company_course_assignments(workspace_id,course_id,assigned_user_id,assigned_by)
    values(purchase_row.workspace_id,purchase_row.course_id,seat_row.assigned_user_id,purchase_row.requested_by)
    on conflict do nothing;
    select assignment.id into assignment_key from public.learning_company_course_assignments assignment
    where assignment.workspace_id = purchase_row.workspace_id and assignment.course_id = purchase_row.course_id
      and assignment.assigned_user_id = seat_row.assigned_user_id and assignment.status = 'active';
    if assignment_key is null then raise exception 'Paid company assignment was not granted' using errcode = '23514'; end if;
    insert into public.learning_company_paid_seat_access(
      purchase_id,assigned_user_id,assignment_id,enrollment_id,
      assignment_was_active_before_purchase,enrollment_was_active_before_purchase)
    values(purchase_row.id,seat_row.assigned_user_id,assignment_key,enrollment_key,
      prior_assignment,prior_enrollment);
    granted_count := granted_count + 1;
  end loop;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(purchase_row.requested_by,'payment_webhook','company_paid_course.access_granted',
    'learning_company_paid_course_purchase',purchase_row.id::text,
    jsonb_build_object('workspace_id',purchase_row.workspace_id,'course_id',purchase_row.course_id,'seat_count',granted_count));
  return query select granted_count;
end;$function$;

create or replace function public.reconcile_learning_company_paid_seat_access()
returns table(purchase_id bigint,assigned_user_id uuid,issue_type text)
language sql stable security definer set search_path to '' as $function$
  select purchase.id,seat.assigned_user_id,'paid_seat_missing_access_provenance'::text
  from public.learning_company_paid_course_purchases purchase
  join public.learning_company_paid_course_purchase_seats seat on seat.purchase_id = purchase.id
  where purchase.status = 'paid' and not exists(
    select 1 from public.learning_company_paid_seat_access access_row
    where access_row.purchase_id = seat.purchase_id and access_row.assigned_user_id = seat.assigned_user_id)
  union all
  select access_row.purchase_id,access_row.assigned_user_id,'active_paid_seat_missing_assignment_or_enrollment'::text
  from public.learning_company_paid_seat_access access_row
  join public.learning_company_paid_course_purchases purchase on purchase.id = access_row.purchase_id
  left join public.learning_company_course_assignments assignment on assignment.id = access_row.assignment_id
  left join public.enrollments enrollment on enrollment.id = access_row.enrollment_id
  where access_row.status = 'active' and (
    assignment.status is distinct from 'active' or enrollment.status not in ('active','completed')
    or assignment.workspace_id is distinct from purchase.workspace_id
    or assignment.course_id is distinct from purchase.course_id
    or assignment.assigned_user_id is distinct from access_row.assigned_user_id
    or enrollment.course_id is distinct from purchase.course_id
    or enrollment.learner_id is distinct from access_row.assigned_user_id);
$function$;

revoke all on function public.protect_learning_company_paid_seat_access(),
  public.grant_paid_learning_company_purchase_access(bigint),
  public.reconcile_learning_company_paid_seat_access() from public,anon,authenticated;
grant execute on function public.grant_paid_learning_company_purchase_access(bigint),
  public.reconcile_learning_company_paid_seat_access() to postgres,service_role;

commit;
