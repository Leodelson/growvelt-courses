create or replace function public.request_paystack_test_full_refund (
  p_order_reference text,
  p_operator_id     uuid,
  p_idempotency_key uuid,
  p_confirmation    text,
  p_reason_code     text,
  p_operator_note   text
)
  returns table (
    case_id                 bigint,
    case_reference          uuid,
    amount_minor            bigint,
    currency                text,
    status                  text,
    provider_transaction_id text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare order_row record; case_row public.learning_payment_cases%rowtype; normalized_note text; normalized_reason text;
begin
  if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_confirmation is distinct from p_order_reference then raise exception 'Exact order-reference confirmation required' using errcode='22023'; end if;
  if p_idempotency_key is null then raise exception 'Refund idempotency key required' using errcode='22023'; end if;
  normalized_reason:=lower(trim(coalesce(p_reason_code,''))); normalized_note:=trim(coalesce(p_operator_note,''));
  if normalized_reason !~ '^[a-z][a-z0-9_]{1,60}$' or char_length(normalized_note) not between 3 and 2000
  then raise exception 'Refund reason and operator note required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('refund:'||p_order_reference,0));
  select o.*,a.id attempt_id,a.provider_transaction_id into order_row from public.learning_orders o
  join public.learning_payment_attempts a on a.order_id=o.id and a.provider='paystack' and a.status='succeeded'
  where o.order_reference=p_order_reference order by a.id desc limit 1 for update of o,a;
  if not found then raise exception 'Paid Paystack order not found' using errcode='P0002'; end if;
  select c.* into case_row from public.learning_payment_cases c where c.idempotency_key=p_idempotency_key;
  if found then
    if case_row.order_id<>order_row.id or case_row.case_type<>'refund' then raise exception 'Refund idempotency conflict' using errcode='23505'; end if;
    return query select case_row.id,case_row.case_reference,case_row.amount_minor,case_row.currency,case_row.status,case_row.provider_transaction_id; return;
  end if;
  if order_row.status<>'paid' then raise exception 'Order is not eligible for a full refund' using errcode='22023'; end if;
  if exists(select 1 from public.learning_payment_cases c where c.order_id=order_row.id and c.case_type='refund' and c.status in ('requested','submitting','pending','processing','needs_attention','processed','succeeded'))
  then raise exception 'A refund already exists for this order' using errcode='23505'; end if;
  insert into public.learning_payment_cases(order_id,payment_attempt_id,case_type,status,amount_minor,currency,reason,initiated_by,
    provider,idempotency_key,provider_transaction_id,requested_amount_minor,reason_code,operator_note,requested_at)
  values(order_row.id,order_row.attempt_id,'refund','requested',order_row.gross_amount_minor,order_row.currency,normalized_note,p_operator_id,
    'paystack',p_idempotency_key,order_row.provider_transaction_id,order_row.gross_amount_minor,normalized_reason,normalized_note,now()) returning * into case_row;
  insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id,note)
  values(case_row.id,'refund.requested','requested','operator',p_operator_id,normalized_note);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','refund.requested','payment_case',case_row.id::text,jsonb_build_object('order_id',order_row.id,'amount_minor',order_row.gross_amount_minor,'currency',order_row.currency,'reason_code',normalized_reason));
  return query select case_row.id,case_row.case_reference,case_row.amount_minor,case_row.currency,case_row.status,case_row.provider_transaction_id;
end;$function$;

grant execute on function "public"."request_paystack_test_full_refund"(text, uuid, uuid, text, text, text) to "postgres", "service_role";

revoke all on function "public"."request_paystack_test_full_refund"(text, uuid, uuid, text, text, text) from public;
