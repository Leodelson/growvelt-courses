begin;

alter table public.learning_payment_cases
  add column dispute_category text,
  add column dispute_reason text,
  add column response_deadline_at timestamptz,
  add column provider_resolution text,
  add column reminded_at timestamptz,
  add column provider_resolved_at timestamptz;

alter table public.learning_payment_cases drop constraint learning_payment_cases_status_check;
alter table public.learning_payment_cases drop constraint learning_payment_cases_provider_status_check;
alter table public.learning_payment_cases
  add constraint learning_payment_cases_status_check check (status in (
    'opened','requested','submitting','pending','processing','needs_attention','processed','succeeded','failed','cancelled',
    'action_required','submitted','under_review','won','lost'
  )),
  add constraint learning_payment_cases_provider_status_check check (provider_status is null or provider_status in (
    'requested','pending','processing','needs-attention','failed','processed','cancelled',
    'awaiting-merchant-feedback','awaiting-bank-feedback','resolved','archived'
  )),
  add constraint learning_payment_cases_dispute_fields_check check (
    case_type <> 'chargeback' or (provider_case_id is not null and requested_amount_minor is null)
  ),
  add constraint learning_payment_cases_dispute_text_check check (
    (dispute_category is null or char_length(dispute_category) <= 120) and
    (dispute_reason is null or char_length(dispute_reason) <= 1000) and
    (provider_resolution is null or char_length(provider_resolution) <= 120)
  );

create unique index learning_payment_cases_one_open_dispute
  on public.learning_payment_cases(order_id)
  where case_type='chargeback' and status in ('opened','action_required','submitted','under_review');
create unique index learning_ledger_one_chargeback_per_case_key
  on public.learning_ledger_transactions(payment_case_id)
  where transaction_type='chargeback' and payment_case_id is not null;

create or replace function public.prevent_learning_payment_case_identity_change()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if old.order_id is distinct from new.order_id or old.payment_attempt_id is distinct from new.payment_attempt_id
    or old.case_type is distinct from new.case_type or old.amount_minor is distinct from new.amount_minor
    or old.currency is distinct from new.currency or old.idempotency_key is distinct from new.idempotency_key
    or old.requested_amount_minor is distinct from new.requested_amount_minor or old.initiated_by is distinct from new.initiated_by
    or (old.provider_case_id is not null and old.provider_case_id is distinct from new.provider_case_id)
  then raise exception 'Payment case financial identity is immutable' using errcode='42501'; end if;
  if old.status is distinct from new.status and not (
    (old.case_type='refund' and (
      (old.status='requested' and new.status in ('submitting','cancelled')) or
      (old.status='submitting' and new.status in ('pending','processing','needs_attention','failed')) or
      (old.status='pending' and new.status in ('processing','needs_attention','processed','failed')) or
      (old.status='processing' and new.status in ('needs_attention','processed','failed')) or
      (old.status='needs_attention' and new.status in ('processing','processed','failed'))
    )) or
    (old.case_type='chargeback' and (
      (old.status='opened' and new.status in ('action_required','under_review','won','lost')) or
      (old.status='action_required' and new.status in ('submitted','under_review','won','lost')) or
      (old.status='submitted' and new.status in ('under_review','won','lost')) or
      (old.status='under_review' and new.status in ('action_required','won','lost'))
    ))
  ) then raise exception 'Unsupported payment case status transition' using errcode='22023'; end if;
  new.updated_at:=now(); return new;
end;$function$;
revoke all on function public.prevent_learning_payment_case_identity_change() from public,anon,authenticated;
grant execute on function public.prevent_learning_payment_case_identity_change() to postgres,service_role;

create or replace function public.receive_paystack_test_dispute_event(
  p_provider_event_id text,p_payload_digest text,p_event_type text,p_transaction_reference text,p_provider_case_id text,
  p_provider_status text,p_resolution text,p_amount_minor bigint,p_currency text,p_domain text,p_category text,
  p_reason text,p_deadline timestamptz,p_payload jsonb)
returns table(outcome text,event_id bigint,case_id bigint) language plpgsql security definer set search_path to '' as $function$
declare order_row record; case_row public.learning_payment_cases%rowtype; event_row public.learning_payment_provider_events%rowtype; normalized_status text;
begin
  if p_event_type not in ('charge.dispute.create','charge.dispute.remind','charge.dispute.resolve') or p_domain<>'test'
    or p_currency<>'NGN' or p_amount_minor<=0 or p_provider_case_id!~'^\d+$'
  then raise exception 'Invalid Paystack dispute event' using errcode='22023'; end if;
  select o.*,a.id attempt_id into order_row from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id
  where o.order_reference=p_transaction_reference and a.provider='paystack' and a.status='succeeded';
  if not found or order_row.status not in ('paid','partially_refunded') or order_row.currency<>p_currency
    or p_amount_minor>order_row.gross_amount_minor
  then raise exception 'Dispute does not match an eligible paid order' using errcode='22023'; end if;
  select * into case_row from public.learning_payment_cases where provider='paystack' and provider_case_id=p_provider_case_id;
  if found and (case_row.order_id<>order_row.id or case_row.amount_minor<>p_amount_minor or case_row.currency<>p_currency)
  then raise exception 'Dispute identity mismatch' using errcode='22023'; end if;
  if not found then
    normalized_status:=case when p_provider_status='awaiting-merchant-feedback' then 'action_required' else 'under_review' end;
    insert into public.learning_payment_cases(order_id,payment_attempt_id,case_type,status,amount_minor,currency,provider,provider_status,
      provider_case_id,provider_transaction_id,dispute_category,dispute_reason,response_deadline_at,provider_resolution,opened_at,action_required_at)
    values(order_row.id,order_row.attempt_id,'chargeback',normalized_status,p_amount_minor,p_currency,'paystack',p_provider_status,
      p_provider_case_id,(select provider_transaction_id from public.learning_payment_attempts where id=order_row.attempt_id),left(p_category,120),left(p_reason,1000),p_deadline,left(p_resolution,120),now(),case when normalized_status='action_required' then now() end)
    returning * into case_row;
    insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,metadata)
    values(case_row.id,'dispute.opened',normalized_status,'webhook',jsonb_build_object('provider_status',p_provider_status,'deadline',p_deadline));
  end if;
  select * into event_row from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id;
  if found then
    if event_row.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',event_row.id,case_row.id; else return query select 'duplicate',event_row.id,case_row.id; end if;
    return;
  end if;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,
    order_id,payment_attempt_id,payment_case_id,verification_source,recovery_status)
  values('paystack',p_provider_event_id,p_event_type,p_payload_digest,p_payload,true,'received',order_row.id,order_row.attempt_id,case_row.id,'webhook','none')
  returning id into event_id;
  return query select 'received',event_id,case_row.id;
end;$function$;

create or replace function public.finalize_paystack_test_chargeback(p_case_id bigint,p_provider_event_id bigint,p_provenance text,p_operator_id uuid)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
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

create or replace function public.process_paystack_test_dispute_event(p_event_id bigint)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare event_row public.learning_payment_provider_events%rowtype; case_row public.learning_payment_cases%rowtype; normalized text; result_row record; ledger_result bigint;
begin
  select * into event_row from public.learning_payment_provider_events where id=p_event_id for update;
  if not found or event_row.provider<>'paystack' or event_row.event_type not like 'charge.dispute.%' then raise exception 'Dispute event not found' using errcode='P0002'; end if;
  if event_row.processing_status='processed' then return query select 'already_processed',event_row.order_id,null::bigint; return; end if;
  select * into case_row from public.learning_payment_cases where id=event_row.payment_case_id and case_type='chargeback' for update;
  if not found then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='No matching dispute case',recovery_status='manual_review' where id=p_event_id; return query select 'unknown_dispute',event_row.order_id,null::bigint; return; end if;
  if event_row.event_type='charge.dispute.remind' then
    normalized:='action_required';
    update public.learning_payment_cases set status=case when status in('opened','under_review') then 'action_required' else status end,reminded_at=now(),action_required_at=coalesce(action_required_at,now()),response_deadline_at=coalesce((event_row.payload->>'due_at')::timestamptz,response_deadline_at),provider_status=coalesce(event_row.payload->>'status',provider_status) where id=case_row.id;
  elsif event_row.event_type='charge.dispute.resolve' then
    if event_row.payload->>'resolution'='merchant-accepted' then
      select * into result_row from public.finalize_paystack_test_chargeback(case_row.id,p_event_id,event_row.verification_source,null);
      ledger_result:=result_row.ledger_transaction_id;
      normalized:='lost';
    elsif event_row.payload->>'resolution'='declined' then
      normalized:='won';
      update public.learning_payment_cases set status='won',provider_status='resolved',provider_resolution='declined',provider_resolved_at=now(),resolved_at=now(),last_verified_at=now() where id=case_row.id;
      insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,metadata) values(case_row.id,'dispute.won','won',event_row.verification_source,p_event_id,event_row.payload);
    else
      normalized:='under_review';
      update public.learning_payment_cases set status=case when status='action_required' then 'under_review' else status end,provider_status=coalesce(event_row.payload->>'status',provider_status),provider_resolution=event_row.payload->>'resolution' where id=case_row.id;
    end if;
  else
    normalized:=case when event_row.payload->>'status'='awaiting-merchant-feedback' then 'action_required' else 'under_review' end;
    update public.learning_payment_cases set status=case when status='opened' then normalized else status end,provider_status=coalesce(event_row.payload->>'status',provider_status) where id=case_row.id;
  end if;
  if event_row.event_type<>'charge.dispute.resolve' or normalized not in('won','lost') then
    insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,metadata) values(case_row.id,event_row.event_type,normalized,event_row.verification_source,p_event_id,event_row.payload);
  end if;
  update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_attempts=processing_attempts+1,last_attempted_at=now(),processing_error=null,recovery_status='resolved' where id=p_event_id;
  return query select normalized,event_row.order_id,ledger_result;
exception when others then
  update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_attempts=processing_attempts+1,last_attempted_at=now(),processing_error=left(sqlerrm,2000),recovery_status='manual_review' where id=p_event_id;
  raise;
end;$function$;

create or replace function public.receive_paystack_test_verified_dispute(
  p_case_id bigint,p_provider_status text,p_resolution text,p_amount_minor bigint,p_currency text,p_domain text,
  p_category text,p_reason text,p_deadline timestamptz,p_payload jsonb,p_operator_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare case_row record; event_key bigint; event_name text;
begin
  if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
  select c.*,o.order_reference into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
  where c.id=p_case_id and c.case_type='chargeback';
  if not found or p_domain<>'test' or p_currency<>case_row.currency or p_amount_minor<>case_row.amount_minor
  then raise exception 'Verified dispute does not match its case' using errcode='22023'; end if;
  event_name:=case when p_provider_status='resolved' then 'charge.dispute.resolve' when p_provider_status='awaiting-merchant-feedback' then 'charge.dispute.remind' else 'charge.dispute.create' end;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
  values('paystack','provider_api:dispute:'||case_row.provider_case_id||':'||coalesce(p_provider_status,'unknown')||':'||coalesce(p_resolution,'none'),event_name,
    encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,case_row.id,'retryable')
  on conflict(provider,provider_event_id) do update set last_attempted_at=now()
  returning id into event_key;
  update public.learning_payment_cases set last_verified_at=now(),provider_status=p_provider_status,provider_resolution=coalesce(p_resolution,provider_resolution),dispute_category=coalesce(left(p_category,120),dispute_category),dispute_reason=coalesce(left(p_reason,1000),dispute_reason),response_deadline_at=coalesce(p_deadline,response_deadline_at) where id=p_case_id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','dispute.verified_via_api','payment_case',p_case_id::text,jsonb_build_object('provider_status',p_provider_status,'event_id',event_key));
  return event_key;
end;$function$;

create or replace function public.get_learning_dispute_case_for_recovery(p_operator_id uuid,p_case_id bigint)
returns table(case_id bigint,provider_case_id text,order_reference text,amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.provider_case_id,o.order_reference,c.amount_minor,c.currency from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='chargeback' and c.status in('opened','action_required','submitted','under_review') and c.provider_case_id is not null;
end;$function$;

create or replace function public.list_learning_dispute_cases(p_operator_id uuid,p_order_id bigint)
returns table(case_id bigint,order_id bigint,order_reference text,status text,amount_minor bigint,currency text,provider_case_id text,provider_status text,provider_resolution text,dispute_category text,dispute_reason text,response_deadline_at timestamptz,action_required_at timestamptz,opened_at timestamptz,resolved_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.order_id,o.order_reference,c.status,c.amount_minor,c.currency,c.provider_case_id,c.provider_status,c.provider_resolution,c.dispute_category,c.dispute_reason,c.response_deadline_at,c.action_required_at,c.opened_at,c.resolved_at
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='chargeback' and (p_order_id is null or c.order_id=p_order_id) order by c.opened_at desc,c.id desc;
end;$function$;

create or replace function public.reconcile_paystack_test_disputes()
returns table(issue_type text,order_reference text,detail text) language sql stable security definer set search_path to '' as $function$
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

revoke all on function public.receive_paystack_test_dispute_event(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,jsonb),public.finalize_paystack_test_chargeback(bigint,bigint,text,uuid),public.process_paystack_test_dispute_event(bigint),public.receive_paystack_test_verified_dispute(bigint,text,text,bigint,text,text,text,text,timestamptz,jsonb,uuid),public.get_learning_dispute_case_for_recovery(uuid,bigint),public.list_learning_dispute_cases(uuid,bigint),public.reconcile_paystack_test_disputes() from public,anon,authenticated;
grant execute on function public.receive_paystack_test_dispute_event(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,jsonb),public.finalize_paystack_test_chargeback(bigint,bigint,text,uuid),public.process_paystack_test_dispute_event(bigint),public.receive_paystack_test_verified_dispute(bigint,text,text,bigint,text,text,text,text,timestamptz,jsonb,uuid),public.get_learning_dispute_case_for_recovery(uuid,bigint),public.list_learning_dispute_cases(uuid,bigint),public.reconcile_paystack_test_disputes() to postgres,service_role;

commit;
