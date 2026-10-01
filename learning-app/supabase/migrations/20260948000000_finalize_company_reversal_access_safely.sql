-- Phase 3C: revoke exact company-paid seat provenance after a posted reversal.
-- Shared assignments/enrollments may have another unrecorded grant source;
-- retain them for explicit review rather than risk revoking valid learning.
-- This is a service-only draft; a trusted provider-verified workflow must
-- post the commercial reversal before calling it in the same transaction.
-- Forward-fix rollback: revoke function execute; retain outcome audit rows.
begin;

create table public.learning_company_reversal_access_results (
  reversal_id bigint not null,
  assigned_user_id uuid not null,
  assignment_id bigint not null references public.learning_company_course_assignments(id) on delete restrict,
  enrollment_id bigint not null references public.enrollments(id) on delete restrict,
  assignment_cancelled boolean not null,
  enrollment_cancelled boolean not null,
  requires_manual_access_review boolean not null,
  processed_at timestamptz not null default now(),
  primary key(reversal_id,assigned_user_id),
  foreign key(reversal_id,assigned_user_id)
    references public.learning_company_commercial_reversal_lines(reversal_id,assigned_user_id) on delete restrict
);
alter table public.learning_company_reversal_access_results enable row level security;
revoke all on public.learning_company_reversal_access_results from public,anon,authenticated,service_role;
grant select on public.learning_company_reversal_access_results to service_role;
create trigger prevent_learning_company_reversal_access_result_mutation
before update or delete on public.learning_company_reversal_access_results
for each row execute function public.prevent_learning_company_sale_mutation();

create or replace function public.apply_learning_company_reversal_access(p_reversal_id bigint)
returns table(reversed_seat_count integer,assignments_cancelled integer,enrollments_cancelled integer)
language plpgsql security definer set search_path to '' as $function$
declare reversal_row public.learning_company_commercial_reversals%rowtype;
  purchase_row public.learning_company_paid_course_purchases%rowtype;
  seat_row record; access_row public.learning_company_paid_seat_access%rowtype;
  existing_result public.learning_company_reversal_access_results%rowtype;
  review_required boolean;
  reversed_count integer := 0; assignment_count integer := 0; enrollment_count integer := 0;
begin
  if p_reversal_id is null then raise exception 'Company reversal is required' using errcode = '22023'; end if;
  select * into reversal_row from public.learning_company_commercial_reversals reversal
  where reversal.id = p_reversal_id for share;
  if not found then raise exception 'Posted company reversal was not found' using errcode = '22023'; end if;
  -- Match the lock ordering used by company access grants and ledger posting.
  select * into purchase_row from public.learning_company_paid_course_purchases purchase
  where purchase.id = reversal_row.purchase_id and purchase.status = 'paid' for update;
  if not found then raise exception 'Paid company purchase is required' using errcode = '22023'; end if;
  perform 1 from public.learning_courses course where course.id = purchase_row.course_id;
  if not found then raise exception 'Company course was not found' using errcode = '22023'; end if;
  for seat_row in
    select line.assigned_user_id from public.learning_company_commercial_reversal_lines line
    where line.reversal_id = reversal_row.id and line.purchase_id = purchase_row.id
    order by line.assigned_user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('learning-company-paid-access:' ||
      purchase_row.course_id::text || ':' || seat_row.assigned_user_id::text,0));
    select * into access_row from public.learning_company_paid_seat_access access_source
    where access_source.purchase_id = purchase_row.id
      and access_source.assigned_user_id = seat_row.assigned_user_id for update;
    if not found then raise exception 'Paid-seat access provenance is required' using errcode = '22023'; end if;
    select * into existing_result from public.learning_company_reversal_access_results result_row
    where result_row.reversal_id = reversal_row.id
      and result_row.assigned_user_id = seat_row.assigned_user_id;
    if found then
      if access_row.status <> (case when reversal_row.reversal_type = 'processed_refund' then 'refunded' else 'chargeback' end)
         or existing_result.assignment_id <> access_row.assignment_id
         or existing_result.enrollment_id <> access_row.enrollment_id then
        raise exception 'Company reversal access replay conflicts with prior result' using errcode = '23505';
      end if;
      reversed_count := reversed_count + 1;
      assignment_count := assignment_count + existing_result.assignment_cancelled::integer;
      enrollment_count := enrollment_count + existing_result.enrollment_cancelled::integer;
      continue;
    end if;
    if access_row.status <> 'active' then
      raise exception 'Company paid seat was already reversed by another case' using errcode = '23505';
    end if;
    update public.learning_company_paid_seat_access
    set status = case when reversal_row.reversal_type = 'processed_refund' then 'refunded' else 'chargeback' end,
      revoked_at = now()
    where purchase_id = purchase_row.id and assigned_user_id = seat_row.assigned_user_id;
    -- A later independent/free grant can reuse these same rows without leaving
    -- provenance. Cancellation cannot be proven safe from the purchase snapshot.
    select exists(select 1 from public.learning_company_course_assignments assignment
      where assignment.id = access_row.assignment_id and assignment.status = 'active')
      or exists(select 1 from public.enrollments enrollment
        where enrollment.id = access_row.enrollment_id and enrollment.status in ('active','completed'))
      into review_required;
    insert into public.learning_company_reversal_access_results(
      reversal_id,assigned_user_id,assignment_id,enrollment_id,assignment_cancelled,
      enrollment_cancelled,requires_manual_access_review)
    values(reversal_row.id,seat_row.assigned_user_id,access_row.assignment_id,access_row.enrollment_id,
      false,false,review_required);
    reversed_count := reversed_count + 1;
  end loop;
  if reversed_count <> (select count(*) from public.learning_company_commercial_reversal_lines line
      where line.reversal_id = reversal_row.id) then
    raise exception 'Company reversal seat result count mismatch' using errcode = '23514';
  end if;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(null,'payment_system','company_paid_course.reversal_access_applied',
    'learning_company_commercial_reversal',reversal_row.id::text,
    jsonb_build_object('reversed_seat_count',reversed_count,'assignments_cancelled',assignment_count,
      'enrollments_cancelled',enrollment_count));
  return query select reversed_count,assignment_count,enrollment_count;
end;$function$;

create or replace function public.reconcile_learning_company_reversal_access()
returns table(reversal_id bigint,assigned_user_id uuid,issue_type text)
language sql stable security definer set search_path to '' as $function$
  select line.reversal_id,line.assigned_user_id,'company_reversal_access_not_applied'::text
  from public.learning_company_commercial_reversal_lines line
  where not exists(select 1 from public.learning_company_reversal_access_results result_row
    where result_row.reversal_id = line.reversal_id and result_row.assigned_user_id = line.assigned_user_id)
  union all
  select result_row.reversal_id,result_row.assigned_user_id,'company_reversed_seat_still_active'::text
  from public.learning_company_reversal_access_results result_row
  join public.learning_company_commercial_reversals reversal on reversal.id = result_row.reversal_id
  join public.learning_company_paid_seat_access access_row
    on access_row.purchase_id = reversal.purchase_id
      and access_row.assigned_user_id = result_row.assigned_user_id
  where access_row.status = 'active'
  union all
  select result_row.reversal_id,result_row.assigned_user_id,'company_reversal_shared_access_review_required'::text
  from public.learning_company_reversal_access_results result_row
  where result_row.requires_manual_access_review;
$function$;

revoke all on function public.apply_learning_company_reversal_access(bigint),
  public.reconcile_learning_company_reversal_access() from public,anon,authenticated;
grant execute on function public.apply_learning_company_reversal_access(bigint),
  public.reconcile_learning_company_reversal_access() to postgres,service_role;

commit;
