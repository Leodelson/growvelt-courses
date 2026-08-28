create or replace function public.finalize_paystack_test_chargeback (
  p_case_id           bigint,
  p_provider_event_id bigint,
  p_provenance        text,
  p_operator_id       uuid
)
  returns table (
    outcome               text,
    order_id              bigint,
    ledger_transaction_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare case_row record; ledger_key bigint; entitlement_row record; reversed_minor bigint;
begin
  if p_provenance not in ('webhook','provider_api') then raise exception 'Invalid chargeback provenance' using errcode='22023'; end if;
  select c.*,o.status order_status,o.gross_amount_minor into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
  where c.id=p_case_id and c.case_type='chargeback' for update of c,o;
  if not found then raise exception 'Dispute case not found' using errcode='P0002'; end if;
  select id into ledger_key from public.learning_ledger_transactions where payment_case_id=p_case_id and transaction_type='chargeback';
  if found then return query select 'already_finalized',case_row.order_id,ledger_key; return; end if;
  if case_row.status='won' then raise exception 'Won dispute cannot create a chargeback' using errcode='22023'; end if;
  select coalesce(sum(abs(e.amount_minor))/2,0) into reversed_minor from public.learning_ledger_transactions t join public.learning_ledger_entries e on e.transaction_id=t.id
  where t.order_id=case_row.order_id and t.transaction_type in ('refund','chargeback');
  if case_row.order_status<>'paid' or reversed_minor+case_row.amount_minor>case_row.gross_amount_minor
  then raise exception 'Chargeback exceeds remaining paid balance' using errcode='22023'; end if;
  insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by)
  values(case_row.order_id,p_case_id,'chargeback',case_row.currency,'Paystack dispute financial loss',p_operator_id) returning id into ledger_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values
    (ledger_key,1,'liability.marketplace_sales_unallocated',case_row.amount_minor,case_row.currency,'payment_case',case_row.case_reference::text),
    (ledger_key,2,'asset.paystack_receivable',-case_row.amount_minor,case_row.currency,'paystack_dispute',case_row.provider_case_id);
  update public.learning_orders set status='chargeback',updated_at=now() where id=case_row.order_id;
  update public.learning_course_entitlements e set status='chargeback',revoked_at=now(),revocation_reason='Paystack dispute resolved against Growvelt'
  where e.order_id=case_row.order_id and e.status='active' returning e.id,e.enrollment_id into entitlement_row;
  if entitlement_row.enrollment_id is not null then update public.enrollments set status='cancelled' where id=entitlement_row.enrollment_id and status in('active','completed'); end if;
  update public.learning_payment_cases set status='lost',processed_amount_minor=amount_minor,processed_at=now(),resolved_at=now(),provider_resolved_at=now(),last_verified_at=now() where id=p_case_id;
  insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,operator_id,metadata)
  values(p_case_id,'dispute.lost','lost',p_provenance,p_provider_event_id,p_operator_id,jsonb_build_object('ledger_transaction_id',ledger_key));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,case when p_operator_id is null then 'payment_system' else 'admin_operator' end,'chargeback.finalized','payment_case',p_case_id::text,jsonb_build_object('order_id',case_row.order_id,'ledger_transaction_id',ledger_key,'amount_minor',case_row.amount_minor));
  return query select 'chargeback_finalized',case_row.order_id,ledger_key;
end;$function$;

grant execute on function "public"."finalize_paystack_test_chargeback"(bigint, bigint, text, uuid) to "postgres", "service_role";

revoke all on function "public"."finalize_paystack_test_chargeback"(bigint, bigint, text, uuid) from public;
