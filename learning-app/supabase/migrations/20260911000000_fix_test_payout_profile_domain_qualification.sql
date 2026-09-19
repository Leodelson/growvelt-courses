-- Forward-only repair: avoid collision between the function's OUT
-- provider_domain column and the payout-profile table column.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.create_learning_instructor_paystack_test_payout_profile(uuid,text,text,text,text,text,text,uuid)'::regprocedure
  ) into definition;

  if definition is null then
    raise exception 'Expected Test payout-profile function is missing';
  end if;

  definition := replace(
    definition,
    'from public.learning_instructor_payout_profiles' || chr(10) || '  where instructor_id=p_instructor_id and provider=''paystack'' and provider_domain=''test'' and status=''active''',
    'from public.learning_instructor_payout_profiles payout_profile' || chr(10) || '  where payout_profile.instructor_id=p_instructor_id and payout_profile.provider=''paystack'' and payout_profile.provider_domain=''test'' and payout_profile.status=''active'''
  );
  definition := replace(
    definition,
    'from public.learning_instructor_payout_profiles' || chr(10) || '  where instructor_id=p_instructor_id and provider=''paystack'' and provider_domain=''test''' || chr(10) || '    and recipient_code=p_recipient_code and provider_recipient_id=p_provider_recipient_id',
    'from public.learning_instructor_payout_profiles payout_profile' || chr(10) || '  where payout_profile.instructor_id=p_instructor_id and payout_profile.provider=''paystack'' and payout_profile.provider_domain=''test''' || chr(10) || '    and payout_profile.recipient_code=p_recipient_code and payout_profile.provider_recipient_id=p_provider_recipient_id'
  );
  execute definition;
end $repair$;

commit;
