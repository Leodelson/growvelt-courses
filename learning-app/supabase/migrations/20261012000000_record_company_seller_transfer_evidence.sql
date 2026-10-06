-- Phase 3C: let the trusted admin server record a transfer only after its
-- independent Paystack Live verifier succeeds. This never initiates a transfer.
begin;

create function public.record_learning_company_seller_transfer_evidence(
  p_boundary_id bigint,p_payout_profile_id bigint,p_provider_transfer_id text,
  p_provider_transfer_code text,p_recipient_code text,p_amount_minor bigint,p_operator_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare boundary_row public.learning_company_seller_outflow_boundaries%rowtype;
  sale_row public.learning_company_commercial_sales%rowtype;
  existing_row public.learning_company_seller_transfer_evidence%rowtype;
  transfer_evidence_id bigint;
begin
  if p_boundary_id is null or p_payout_profile_id is null
     or p_provider_transfer_id is null or p_provider_transfer_id !~ '^[1-9][0-9]{0,18}$'
     or (p_provider_transfer_code is not null
       and p_provider_transfer_code !~ '^TRF_[A-Za-z0-9]+$')
     or p_recipient_code is null or p_recipient_code !~ '^RCP_[A-Za-z0-9]+$'
     or p_amount_minor is null or p_amount_minor <= 0 or p_operator_id is null then
    raise exception 'Invalid company seller transfer evidence' using errcode = '22023';
  end if;

  select * into boundary_row from public.learning_company_seller_outflow_boundaries boundary
  where boundary.id = p_boundary_id;
  if not found or boundary_row.boundary_kind <> 'transferred' then
    raise exception 'A transferred company seller boundary is required' using errcode = '22023';
  end if;
  perform 1 from public.learning_company_paid_course_purchases purchase
  where purchase.id = boundary_row.purchase_id and purchase.status = 'paid' for update;
  if not found then raise exception 'Paid company purchase is required' using errcode = '22023'; end if;

  select * into boundary_row from public.learning_company_seller_outflow_boundaries boundary
  where boundary.id = p_boundary_id;
  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = boundary_row.purchase_id;
  if not found or sale_row.paystack_domain <> 'live' or sale_row.currency <> 'NGN'
     or sale_row.seller_payee_id <> boundary_row.seller_payee_id
     or boundary_row.currency <> 'NGN' or boundary_row.amount_minor <> p_amount_minor then
    raise exception 'Verified transfer does not match the reserved company sale' using errcode = '22023';
  end if;
  if not exists(select 1 from public.account_capabilities capability
      where capability.user_id = p_operator_id
        and capability.capability = 'admin' and capability.status = 'active') then
    raise exception 'Active Learning Admin required to record transfer evidence' using errcode = '42501';
  end if;

  select * into existing_row from public.learning_company_seller_transfer_evidence evidence
  where evidence.boundary_id = p_boundary_id;
  if found then
    if existing_row.purchase_id <> boundary_row.purchase_id
       or existing_row.seller_payee_id <> boundary_row.seller_payee_id
       or existing_row.payout_profile_id <> p_payout_profile_id
       or existing_row.provider_reference <> boundary_row.movement_reference
       or existing_row.provider_transfer_id <> p_provider_transfer_id
       or existing_row.provider_transfer_code is distinct from p_provider_transfer_code
       or existing_row.recipient_code <> p_recipient_code
       or existing_row.amount_minor <> p_amount_minor then
      raise exception 'Company transfer evidence conflicts with an existing record' using errcode = '23505';
    end if;
    return existing_row.id;
  end if;

  insert into public.learning_company_seller_transfer_evidence(
    boundary_id,purchase_id,seller_payee_id,payout_profile_id,provider_reference,
    provider_transfer_id,provider_transfer_code,recipient_code,amount_minor,
    currency,paystack_domain,provider_source,provider_status,verified_by,verified_at)
  values(p_boundary_id,boundary_row.purchase_id,boundary_row.seller_payee_id,
    p_payout_profile_id,boundary_row.movement_reference,p_provider_transfer_id,
    p_provider_transfer_code,p_recipient_code,p_amount_minor,'NGN','live','balance',
    'success',p_operator_id,now())
  returning id into transfer_evidence_id;
  insert into public.learning_audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','company_seller_transfer.evidence_recorded',
    'learning_company_paid_course_purchase',boundary_row.purchase_id::text,
    jsonb_build_object('transfer_evidence_id',transfer_evidence_id,
      'boundary_id',p_boundary_id,'amount_minor',p_amount_minor,'currency','NGN'));
  return transfer_evidence_id;
end;$function$;

revoke all on function public.record_learning_company_seller_transfer_evidence(
  bigint,bigint,text,text,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.record_learning_company_seller_transfer_evidence(
  bigint,bigint,text,text,text,bigint,uuid) to postgres,service_role;

commit;
