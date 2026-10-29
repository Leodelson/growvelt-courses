-- Live recipient setup only. No payout item, earnings release, or transfer is created.
-- Apply separately after review; the application endpoint is disabled by default.
begin;

create function public.create_learning_instructor_paystack_live_payout_profile(
  p_instructor_id uuid, p_recipient_code text, p_provider_recipient_id text,
  p_bank_code text, p_bank_name text, p_account_name text, p_account_last4 text,
  p_actor_user_id uuid
)
returns table(payout_profile_id bigint, status text, provider_domain text,
  recipient_code text, bank_name text, account_name text, account_last4 text, created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare existing_row public.learning_instructor_payout_profiles%rowtype;
        profile_id bigint;
begin
  if p_actor_user_id is distinct from p_instructor_id then
    raise exception 'Instructor ownership is required' using errcode='42501';
  end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);
  if p_recipient_code is null or p_recipient_code !~ '^RCP_[A-Za-z0-9]+$'
    or p_provider_recipient_id is null or p_provider_recipient_id !~ '^[0-9]+$'
    or p_bank_code is null or p_bank_code !~ '^[A-Za-z0-9_-]{2,32}$'
    or p_bank_name is null or char_length(p_bank_name) not between 1 and 160
    or p_account_name is null or char_length(p_account_name) not between 1 and 200
    or p_account_last4 is null or p_account_last4 !~ '^[0-9]{4}$' then
    raise exception 'Invalid payout profile recipient metadata' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('learning-payout-profile:live:'||p_instructor_id::text,0));
  select * into existing_row from public.learning_instructor_payout_profiles profile
    where profile.instructor_id=p_instructor_id and profile.provider='paystack' and profile.provider_domain='live' and profile.status='active'
    for update;
  if found and existing_row.recipient_code=p_recipient_code and existing_row.provider_recipient_id=p_provider_recipient_id
    and existing_row.bank_code=p_bank_code and existing_row.bank_name=p_bank_name
    and existing_row.account_name=p_account_name and existing_row.account_last4=p_account_last4 then
    return query select existing_row.id,existing_row.status,existing_row.provider_domain,existing_row.recipient_code,
      existing_row.bank_name,existing_row.account_name,existing_row.account_last4,existing_row.created_at;
    return;
  end if;
  if found then
    update public.learning_instructor_payout_profiles set status='disabled',disabled_at=now() where id=existing_row.id;
    insert into public.learning_instructor_payout_profile_events(payout_profile_id,instructor_id,event_type,actor_user_id,metadata)
      values(existing_row.id,p_instructor_id,'payout_profile.replaced',p_actor_user_id,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
    insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
      values(p_actor_user_id,'instructor','payout_profile.replaced','learning_instructor_payout_profile',existing_row.id::text,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
  end if;

  select * into existing_row from public.learning_instructor_payout_profiles profile
    where profile.instructor_id=p_instructor_id and profile.provider='paystack' and profile.provider_domain='live'
      and profile.recipient_code=p_recipient_code and profile.provider_recipient_id=p_provider_recipient_id
    for update;
  if found then
    if existing_row.bank_code is distinct from p_bank_code or existing_row.bank_name is distinct from p_bank_name
      or existing_row.account_name is distinct from p_account_name or existing_row.account_last4 is distinct from p_account_last4 then
      raise exception 'Recipient metadata does not match stored identity' using errcode='22023';
    end if;
    update public.learning_instructor_payout_profiles set status='active',disabled_at=null where id=existing_row.id;
    insert into public.learning_instructor_payout_profile_events(payout_profile_id,instructor_id,event_type,actor_user_id,metadata)
      values(existing_row.id,p_instructor_id,'payout_profile.replaced',p_actor_user_id,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
    insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
      values(p_actor_user_id,'instructor','payout_profile.replaced','learning_instructor_payout_profile',existing_row.id::text,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
    return query select existing_row.id,'active','live',existing_row.recipient_code,existing_row.bank_name,
      existing_row.account_name,existing_row.account_last4,existing_row.created_at;
    return;
  end if;

  insert into public.learning_instructor_payout_profiles(
    instructor_id,provider,provider_domain,status,recipient_code,provider_recipient_id,currency,
    bank_code,bank_name,account_name,account_last4,created_by
  ) values (p_instructor_id,'paystack','live','active',p_recipient_code,p_provider_recipient_id,'NGN',
    p_bank_code,p_bank_name,p_account_name,p_account_last4,p_actor_user_id)
  returning id into profile_id;
  insert into public.learning_instructor_payout_profile_events(payout_profile_id,instructor_id,event_type,actor_user_id,metadata)
    values(profile_id,p_instructor_id,'payout_profile.created',p_actor_user_id,
      jsonb_build_object('provider','paystack','provider_domain','live','account_last4',p_account_last4));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_actor_user_id,'instructor','payout_profile.created','learning_instructor_payout_profile',profile_id::text,
      jsonb_build_object('provider','paystack','provider_domain','live','account_last4',p_account_last4));
  return query select profile.id,profile.status,profile.provider_domain,profile.recipient_code,
    profile.bank_name,profile.account_name,profile.account_last4,profile.created_at
    from public.learning_instructor_payout_profiles profile where profile.id=profile_id;
end;$function$;

create function public.disable_own_learning_instructor_paystack_live_payout_profile(p_instructor_id uuid,p_actor_user_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare profile_row public.learning_instructor_payout_profiles%rowtype;
begin
  if p_actor_user_id is distinct from p_instructor_id then raise exception 'Instructor ownership is required' using errcode='42501'; end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);
  perform pg_advisory_xact_lock(hashtextextended('learning-payout-profile:live:'||p_instructor_id::text,0));
  select * into profile_row from public.learning_instructor_payout_profiles
    where instructor_id=p_instructor_id and provider='paystack' and provider_domain='live' and status='active' for update;
  if not found then return false; end if;
  update public.learning_instructor_payout_profiles set status='disabled',disabled_at=now() where id=profile_row.id;
  insert into public.learning_instructor_payout_profile_events(payout_profile_id,instructor_id,event_type,actor_user_id,metadata)
    values(profile_row.id,p_instructor_id,'payout_profile.disabled',p_actor_user_id,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_actor_user_id,'instructor','payout_profile.disabled','learning_instructor_payout_profile',profile_row.id::text,'{"provider":"paystack","provider_domain":"live"}'::jsonb);
  return true;
end;$function$;

revoke all on function public.create_learning_instructor_paystack_live_payout_profile(uuid,text,text,text,text,text,text,uuid),
  public.disable_own_learning_instructor_paystack_live_payout_profile(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_learning_instructor_paystack_live_payout_profile(uuid,text,text,text,text,text,text,uuid),
  public.disable_own_learning_instructor_paystack_live_payout_profile(uuid,uuid) to postgres,service_role;

commit;
