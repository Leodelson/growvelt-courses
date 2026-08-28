create or replace function public.reconcile_paystack_test_learning_payments()
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
 select 'paid_without_successful_attempt',o.order_reference,'Paid order has no successful Paystack attempt' from public.learning_orders o where o.status in('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_payment_attempts a where a.order_id=o.id and a.provider='paystack' and a.status='succeeded')
 union all select 'paid_without_capture_ledger',o.order_reference,'Paid order has no payment-capture ledger transaction' from public.learning_orders o where o.status in('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_ledger_transactions t where t.order_id=o.id and t.transaction_type='payment_capture')
 union all select 'paid_without_entitlement',o.order_reference,'Paid order has no active entitlement' from public.learning_orders o where o.status='paid' and not exists(select 1 from public.learning_course_entitlements e where e.order_id=o.id and e.status='active')
 union all select 'entitlement_without_enrollment',o.order_reference,'Active entitlement has no active or completed enrollment' from public.learning_orders o join public.learning_course_entitlements e on e.order_id=o.id and e.status='active' where not exists(select 1 from public.enrollments n where n.id=e.enrollment_id and n.learner_id=e.learner_id and n.course_id=e.course_id and n.status in('active','completed'))
 union all select 'successful_attempt_unpaid_order',o.order_reference,'Successful attempt belongs to an unpaid order' from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id where a.provider='paystack' and a.status='succeeded' and o.status not in('paid','partially_refunded','refunded','chargeback')
 union all select 'failed_provider_event',coalesce(o.order_reference,'unknown'),left(coalesce(ev.processing_error,'Provider event processing failed'),1000) from public.learning_payment_provider_events ev left join public.learning_orders o on o.id=ev.order_id where ev.provider='paystack' and ev.processing_status='failed'
 union all select 'stale_received_provider_event',coalesce(o.order_reference,'unknown'),'Verified provider event has remained unprocessed for more than five minutes' from public.learning_payment_provider_events ev left join public.learning_orders o on o.id=ev.order_id where ev.provider='paystack' and ev.processing_status='received' and ev.received_at<now()-interval '5 minutes'
 union all select 'stale_pending_attempt',o.order_reference,'Paystack checkout has remained pending for more than two hours' from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id where o.status='payment_pending' and a.provider='paystack' and a.status='pending' and a.initialized_at<now()-interval '2 hours'
 union all select 'capture_ledger_imbalance',o.order_reference,'Capture ledger is not balanced or has fewer than two entries' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type='payment_capture' left join public.learning_ledger_entries e on e.transaction_id=t.id group by o.id,o.order_reference,t.id having count(e.id)<2 or coalesce(sum(e.amount_minor),0)<>0
 union all select 'duplicate_capture_ledger',o.order_reference,'Order has more than one payment-capture ledger transaction' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type='payment_capture' group by o.id,o.order_reference having count(*)>1;
$function$;

grant execute on function "public"."reconcile_paystack_test_learning_payments"() to "postgres", "service_role";

revoke all on function "public"."reconcile_paystack_test_learning_payments"() from public;
