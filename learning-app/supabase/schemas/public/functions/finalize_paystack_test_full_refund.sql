create or replace function public.finalize_paystack_test_full_refund (
  p_case_id           bigint,
  p_provider_event_id bigint,
  p_provenance        text,
  p_operator_id       uuid   default null::uuid
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
declare case_row record; entitlement_row record; ledger_key bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('refund-case:'||p_case_id::text,0));
 select c.*,o.order_reference,o.status order_status,o.gross_amount_minor,o.learner_id,o.course_id into case_row
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.id=p_case_id and c.case_type='refund' for update of c,o;
 if not found then raise exception 'Refund case not found' using errcode='P0002'; end if;
 select id into ledger_key from public.learning_ledger_transactions where payment_case_id=p_case_id and transaction_type='refund';
 if ledger_key is not null then return query select 'already_processed',case_row.order_id,ledger_key; return; end if;
 if case_row.provider_status<>'processed' or case_row.amount_minor<>case_row.gross_amount_minor then raise exception 'Authoritative processed full refund required' using errcode='22023'; end if;
 if case_row.order_status<>'paid' then raise exception 'Order is not refundable' using errcode='22023'; end if;
 insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by)
 values(case_row.order_id,p_case_id,'refund',case_row.currency,'Processed Paystack full course refund',p_operator_id) returning id into ledger_key;
 insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference)
 values(ledger_key,1,'liability.marketplace_sales_unallocated',case_row.amount_minor,case_row.currency,'payment_case',case_row.case_reference::text),
       (ledger_key,2,'asset.paystack_receivable',-case_row.amount_minor,case_row.currency,'payment_provider',coalesce(case_row.provider_case_id,case_row.provider_case_reference));
 update public.learning_orders set status='refunded' where id=case_row.order_id;
 update public.learning_course_entitlements e set status='refunded',revoked_at=now(),revocation_reason='Full Paystack refund processed' where e.order_id=case_row.order_id and e.status='active' returning e.id,e.enrollment_id into entitlement_row;
 if not found then raise exception 'Active entitlement not found' using errcode='P0002'; end if;
 update public.enrollments set status='cancelled' where id=entitlement_row.enrollment_id and learner_id=case_row.learner_id and course_id=case_row.course_id and status in('active','completed');
 if not found then raise exception 'Active or completed enrollment not found' using errcode='P0002'; end if;
 update public.learning_payment_cases set status='processed',processed_amount_minor=amount_minor,processed_at=now(),resolved_at=now(),last_verified_at=now() where id=p_case_id;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,operator_id,metadata)
 values(p_case_id,'refund.processed','processed',p_provenance,p_provider_event_id,p_operator_id,jsonb_build_object('ledger_transaction_id',ledger_key));
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,case when p_operator_id is null then 'payment_system' else 'admin_operator' end,'refund.processed','payment_case',p_case_id::text,jsonb_build_object('order_id',case_row.order_id,'ledger_transaction_id',ledger_key,'amount_minor',case_row.amount_minor));
 return query select 'refunded',case_row.order_id,ledger_key;
end;$function$;

grant execute on function "public"."finalize_paystack_test_full_refund"(bigint, bigint, text, uuid) to "postgres", "service_role";

revoke all on function "public"."finalize_paystack_test_full_refund"(bigint, bigint, text, uuid) from public;
