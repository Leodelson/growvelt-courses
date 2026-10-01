-- One atomic database boundary after a trusted service has independently
-- fetched and verified the final Paystack case. This function does not make
-- a provider request and does not cancel shared learning access.
begin;

create or replace function public.commit_learning_company_reversal_after_verification(
  p_inbox_event_id bigint,p_provider_transaction_id text,p_verified_status text,
  p_verified_resolution text,p_verified_amount_minor bigint,p_selected_user_ids uuid[])
returns table(reversal_id bigint,reversed_seat_count integer,
  assignments_cancelled integer,enrollments_cancelled integer)
language plpgsql security definer set search_path to '' as $function$
declare reversal_key bigint; access_result record;
begin
  -- PostgreSQL runs both calls in this function's invoking transaction. An
  -- exception in either call rolls back the financial posting and source mark.
  reversal_key := public.post_learning_company_commercial_reversal(
    p_inbox_event_id,p_provider_transaction_id,p_verified_status,
    p_verified_resolution,p_verified_amount_minor,p_selected_user_ids);
  select * into access_result
  from public.apply_learning_company_reversal_access(reversal_key);
  if not found or access_result.reversed_seat_count <> cardinality(p_selected_user_ids)
     or access_result.assignments_cancelled <> 0
     or access_result.enrollments_cancelled <> 0 then
    raise exception 'Company reversal access result did not match the verified seat selection'
      using errcode='23514';
  end if;
  return query select reversal_key,access_result.reversed_seat_count,
    access_result.assignments_cancelled,access_result.enrollments_cancelled;
end;$function$;

-- The service must not post money without recording the seat-source outcome,
-- or mark seats reversed without the matching financial posting. The owner
-- (postgres) retains execute so the wrapper can call both under definer rights.
revoke execute on function public.post_learning_company_commercial_reversal(
  bigint,text,text,text,bigint,uuid[]),
  public.apply_learning_company_reversal_access(bigint)
  from service_role;
revoke all on function public.commit_learning_company_reversal_after_verification(
  bigint,text,text,text,bigint,uuid[]) from public,anon,authenticated;
grant execute on function public.commit_learning_company_reversal_after_verification(
  bigint,text,text,text,bigint,uuid[]) to postgres,service_role;

commit;
