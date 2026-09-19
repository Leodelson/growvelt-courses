-- Forward-only repair for the payout-approval RPC's OUT-column status collision.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.approve_learning_instructor_payout_item(bigint,text,uuid)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'Expected payout approval function is missing';
  end if;
  if position('from public.learning_instructor_payout_profiles payout_profile where payout_profile.instructor_id=r.instructor_id and payout_profile.provider=''paystack'' and payout_profile.provider_domain=''test'' and payout_profile.status=''active'' for update' in definition) > 0 then
    return;
  end if;
  if position('from public.learning_instructor_payout_profiles where instructor_id=r.instructor_id and provider=''paystack'' and provider_domain=''test'' and status=''active'' for update' in definition) = 0 then
    raise exception 'Expected unqualified payout-profile status guard is missing';
  end if;
  definition := replace(
    definition,
    'from public.learning_instructor_payout_profiles where instructor_id=r.instructor_id and provider=''paystack'' and provider_domain=''test'' and status=''active'' for update',
    'from public.learning_instructor_payout_profiles payout_profile where payout_profile.instructor_id=r.instructor_id and payout_profile.provider=''paystack'' and payout_profile.provider_domain=''test'' and payout_profile.status=''active'' for update'
  );
  execute definition;
end $repair$;

commit;
