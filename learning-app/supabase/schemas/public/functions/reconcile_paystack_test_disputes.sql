create or replace function public.reconcile_paystack_test_disputes()
  returns table (
    issue_type      text,
    order_reference text,
    detail          text
  )
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
 select 'provider_resolved_local_unresolved',o.order_reference,'Provider dispute is resolved but local case is unresolved' from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='chargeback' and c.provider_status='resolved' and c.status not in('won','lost')
 union all select 'action_required_deadline_due',o.order_reference,'Dispute requires action and its response deadline is within 24 hours or past' from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='chargeback' and c.status='action_required' and c.response_deadline_at is not null and c.response_deadline_at<now()+interval '24 hours'
 union all select 'lost_without_chargeback',o.order_reference,'Lost dispute has no chargeback ledger' from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='chargeback' and c.status='lost' and not exists(select 1 from public.learning_ledger_transactions t where t.payment_case_id=c.id and t.transaction_type='chargeback')
 union all select 'won_with_chargeback',o.order_reference,'Won dispute has an economic reversal' from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id join public.learning_ledger_transactions t on t.payment_case_id=c.id and t.transaction_type='chargeback' where c.case_type='chargeback' and c.status='won'
 union all select 'duplicate_chargeback',o.order_reference,'Order has multiple chargeback ledger transactions' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type='chargeback' group by o.id,o.order_reference having count(*)>1
 union all select 'chargeback_active_entitlement',o.order_reference,'Chargeback order retains active entitlement' from public.learning_orders o join public.learning_course_entitlements e on e.order_id=o.id and e.status='active' where o.status='chargeback'
 union all select 'chargeback_active_enrollment',o.order_reference,'Chargeback order retains active or completed enrollment' from public.learning_orders o join public.learning_course_entitlements e on e.order_id=o.id join public.enrollments n on n.id=e.enrollment_id and n.status in('active','completed') where o.status='chargeback'
 union all select 'double_economic_reversal',o.order_reference,'Order contains both refund and chargeback reversals' from public.learning_orders o join public.learning_ledger_transactions r on r.order_id=o.id and r.transaction_type='refund' join public.learning_ledger_transactions c on c.order_id=o.id and c.transaction_type='chargeback'
 union all select 'reversal_exceeds_gross',o.order_reference,'Economic reversals exceed gross paid amount' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type in('refund','chargeback') join public.learning_ledger_entries e on e.transaction_id=t.id group by o.id,o.order_reference,o.gross_amount_minor having sum(abs(e.amount_minor))/2>o.gross_amount_minor
 union all select 'failed_dispute_event',coalesce(o.order_reference,'unknown'),coalesce(e.processing_error,'Dispute provider event failed') from public.learning_payment_provider_events e left join public.learning_orders o on o.id=e.order_id where e.event_type like 'charge.dispute.%' and e.processing_status='failed'
 union all select 'stale_dispute_event',coalesce(o.order_reference,'unknown'),'Dispute event remains unprocessed' from public.learning_payment_provider_events e left join public.learning_orders o on o.id=e.order_id where e.event_type like 'charge.dispute.%' and e.processing_status='received' and e.received_at<now()-interval '5 minutes';
$function$;

grant execute on function "public"."reconcile_paystack_test_disputes"() to "postgres", "service_role";

revoke all on function "public"."reconcile_paystack_test_disputes"() from public;
