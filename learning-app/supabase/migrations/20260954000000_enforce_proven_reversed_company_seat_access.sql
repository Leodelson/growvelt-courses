-- Apply a verified reversal to its exact paid-seat source. Only an active
-- enrollment with no other evidenced source and no ambiguous history may be
-- cancelled. Preserve all progress rows and historical certificates.
-- This migration must be deployed with the preceding source-provenance and
-- atomic-reversal migrations; it does not authorize live company checkout.
begin;

create or replace function public.apply_learning_company_reversal_access(p_reversal_id bigint)
returns table(reversed_seat_count integer,assignments_cancelled integer,enrollments_cancelled integer)
language plpgsql security definer set search_path to '' as $function$
declare reversal_row public.learning_company_commercial_reversals%rowtype;
  purchase_row public.learning_company_paid_course_purchases%rowtype;
  seat_row record; access_row public.learning_company_paid_seat_access%rowtype;
  existing_result public.learning_company_reversal_access_results%rowtype;
  source_decision record; assignment_changed integer; enrollment_changed integer;
  review_required boolean; reversed_count integer := 0;
  assignment_count integer := 0; enrollment_count integer := 0;
begin
  if p_reversal_id is null then raise exception 'Company reversal is required' using errcode='22023'; end if;
  select * into reversal_row from public.learning_company_commercial_reversals reversal
  where reversal.id=p_reversal_id for share;
  if not found then raise exception 'Posted company reversal was not found' using errcode='22023'; end if;
  select * into purchase_row from public.learning_company_paid_course_purchases purchase
  where purchase.id=reversal_row.purchase_id and purchase.status='paid' for update;
  if not found then raise exception 'Paid company purchase is required' using errcode='22023'; end if;
  for seat_row in
    select line.assigned_user_id from public.learning_company_commercial_reversal_lines line
    where line.reversal_id=reversal_row.id and line.purchase_id=purchase_row.id
    order by line.assigned_user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('learning-company-paid-access:' ||
      purchase_row.course_id::text || ':' || seat_row.assigned_user_id::text,0));
    select * into access_row from public.learning_company_paid_seat_access source
    where source.purchase_id=purchase_row.id
      and source.assigned_user_id=seat_row.assigned_user_id for update;
    if not found then raise exception 'Paid-seat access provenance is required' using errcode='22023'; end if;
    select * into existing_result from public.learning_company_reversal_access_results result_row
    where result_row.reversal_id=reversal_row.id
      and result_row.assigned_user_id=seat_row.assigned_user_id;
    if found then
      if access_row.status <> (case when reversal_row.reversal_type='processed_refund'
          then 'refunded' else 'chargeback' end)
         or existing_result.assignment_id <> access_row.assignment_id
         or existing_result.enrollment_id <> access_row.enrollment_id then
        raise exception 'Company reversal access replay conflicts with prior result' using errcode='23505';
      end if;
      reversed_count := reversed_count+1;
      assignment_count := assignment_count+existing_result.assignment_cancelled::integer;
      enrollment_count := enrollment_count+existing_result.enrollment_cancelled::integer;
      continue;
    end if;
    if access_row.status <> 'active' then
      raise exception 'Company paid seat was already reversed by another case' using errcode='23505';
    end if;
    -- All grant paths reuse this same enrollment row. Holding its row lock
    -- until commit serializes a new free/personal grant with the source check.
    perform 1 from public.enrollments enrollment
    where enrollment.id=access_row.enrollment_id
      and enrollment.learner_id=seat_row.assigned_user_id
      and enrollment.course_id=purchase_row.course_id for update;
    if not found then raise exception 'Company seat enrollment was not found' using errcode='22023'; end if;
    update public.learning_company_paid_seat_access
    set status=case when reversal_row.reversal_type='processed_refund' then 'refunded' else 'chargeback' end,
      revoked_at=now()
    where purchase_id=purchase_row.id and assigned_user_id=seat_row.assigned_user_id;
    select * into source_decision from public.resolve_learning_course_access_sources(
      seat_row.assigned_user_id,purchase_row.course_id);
    if not found or source_decision.enrollment_id is distinct from access_row.enrollment_id
       and source_decision.decision <> 'not_enrolled' then
      raise exception 'Company reversal access source result was inconclusive' using errcode='23514';
    end if;
    assignment_changed := 0;
    enrollment_changed := 0;
    if source_decision.decision='reversed_only' then
      update public.learning_company_course_assignments
      set status='cancelled',cancelled_at=now()
      where id=access_row.assignment_id and assigned_user_id=seat_row.assigned_user_id
        and course_id=purchase_row.course_id and status='active';
      get diagnostics assignment_changed = row_count;
      update public.enrollments set status='cancelled'
      where id=access_row.enrollment_id and learner_id=seat_row.assigned_user_id
        and course_id=purchase_row.course_id and status='active';
      get diagnostics enrollment_changed = row_count;
      if enrollment_changed <> 1 then
        raise exception 'Exclusive company seat enrollment could not be ended' using errcode='23514';
      end if;
    elsif source_decision.decision not in ('confirmed_source','manual_review','not_enrolled') then
      raise exception 'Unexpected company reversal access decision' using errcode='23514';
    end if;
    review_required := source_decision.decision='manual_review';
    insert into public.learning_company_reversal_access_results(
      reversal_id,assigned_user_id,assignment_id,enrollment_id,
      assignment_cancelled,enrollment_cancelled,requires_manual_access_review)
    values(reversal_row.id,seat_row.assigned_user_id,access_row.assignment_id,
      access_row.enrollment_id,assignment_changed=1,enrollment_changed=1,review_required);
    reversed_count := reversed_count+1;
    assignment_count := assignment_count+assignment_changed;
    enrollment_count := enrollment_count+enrollment_changed;
  end loop;
  if reversed_count <> (select count(*) from public.learning_company_commercial_reversal_lines line
      where line.reversal_id=reversal_row.id) then
    raise exception 'Company reversal seat result count mismatch' using errcode='23514';
  end if;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(null,'payment_system','company_paid_course.reversal_access_applied',
    'learning_company_commercial_reversal',reversal_row.id::text,
    jsonb_build_object('reversed_seat_count',reversed_count,
      'assignments_cancelled',assignment_count,'enrollments_cancelled',enrollment_count));
  return query select reversed_count,assignment_count,enrollment_count;
end;$function$;

create or replace function public.commit_learning_company_reversal_after_verification(
  p_inbox_event_id bigint,p_provider_transaction_id text,p_verified_status text,
  p_verified_resolution text,p_verified_amount_minor bigint,p_selected_user_ids uuid[])
returns table(reversal_id bigint,reversed_seat_count integer,
  assignments_cancelled integer,enrollments_cancelled integer)
language plpgsql security definer set search_path to '' as $function$
declare reversal_key bigint; access_result record;
begin
  reversal_key := public.post_learning_company_commercial_reversal(
    p_inbox_event_id,p_provider_transaction_id,p_verified_status,
    p_verified_resolution,p_verified_amount_minor,p_selected_user_ids);
  select * into access_result from public.apply_learning_company_reversal_access(reversal_key);
  if not found or access_result.reversed_seat_count <> cardinality(p_selected_user_ids)
     or access_result.assignments_cancelled < 0
     or access_result.enrollments_cancelled < 0
     or access_result.assignments_cancelled > access_result.reversed_seat_count
     or access_result.enrollments_cancelled > access_result.reversed_seat_count then
    raise exception 'Company reversal access result did not match the verified seats'
      using errcode='23514';
  end if;
  return query select reversal_key,access_result.reversed_seat_count,
    access_result.assignments_cancelled,access_result.enrollments_cancelled;
end;$function$;

revoke all on function public.apply_learning_company_reversal_access(bigint),
  public.commit_learning_company_reversal_after_verification(
    bigint,text,text,text,bigint,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.apply_learning_company_reversal_access(bigint) to postgres;
grant execute on function public.commit_learning_company_reversal_after_verification(
  bigint,text,text,text,bigint,uuid[]) to postgres,service_role;

commit;
