-- Keep self-service account deletion explicit and safe after Phase 2A.
-- Organization identity, membership and invitation records are provider records,
-- so they must be handled through managed offboarding rather than failing on a
-- foreign-key constraint after the user has already confirmed deletion.

alter table public.learning_account_deletion_requests enable row level security;
revoke all on table public.learning_account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.learning_account_deletion_requests to postgres, service_role;

create or replace function public.request_own_learning_account_deletion(
  p_certificate_choice text
)
returns table (
  outcome text,
  certificate_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  own_user_id uuid := auth.uid();
  own_certificate_count integer;
begin
  if own_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_certificate_choice not in ('keep_verifiable', 'remove_public_verification') then
    raise exception 'Choose how earned certificates should be handled' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = own_user_id for update;
  if not found then
    raise exception 'Learning profile not found' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into own_certificate_count
  from public.certificates
  where learner_id = own_user_id;

  if exists (
    select 1
    from public.account_capabilities
    where user_id = own_user_id
      and capability = 'admin'
      and status = 'active'
  ) then
    return query select 'admin_offboarding_required'::text, own_certificate_count;
    return;
  end if;

  if exists (select 1 from public.learning_courses where instructor_id = own_user_id)
    or exists (select 1 from public.course_rights_declarations where instructor_id = own_user_id)
  then
    return query select 'instructor_offboarding_required'::text, own_certificate_count;
    return;
  end if;

  if exists (select 1 from public.learning_provider_organizations where created_by = own_user_id)
    or exists (select 1 from public.learning_provider_organization_memberships where user_id = own_user_id or granted_by = own_user_id)
    or exists (select 1 from public.learning_provider_organization_membership_events where user_id = own_user_id or actor_user_id = own_user_id)
    or exists (select 1 from public.learning_provider_organization_invitations where invited_user_id = own_user_id or invited_by = own_user_id)
    or exists (select 1 from public.learning_provider_organization_invitation_events where actor_user_id = own_user_id)
    or exists (select 1 from public.learning_instructor_notifications where instructor_user_id = own_user_id)
  then
    return query select 'organization_offboarding_required'::text, own_certificate_count;
    return;
  end if;

  insert into public.learning_account_deletion_requests (user_id, certificate_choice, requested_at)
  values (own_user_id, p_certificate_choice, now())
  on conflict (user_id) do update
    set certificate_choice = excluded.certificate_choice,
        requested_at = excluded.requested_at;

  return query select 'ready'::text, own_certificate_count;
end;
$function$;

revoke all on function public.request_own_learning_account_deletion(text) from public, anon;
grant execute on function public.request_own_learning_account_deletion(text) to authenticated, postgres, service_role;

create or replace function public.apply_learning_account_deletion_retention()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  requested_choice text;
begin
  if exists (
    select 1
    from public.account_capabilities
    where user_id = old.id
      and capability = 'admin'
      and status = 'active'
  ) then
    raise exception 'Active Learning administrators require managed offboarding' using errcode = '42501';
  end if;

  if exists (select 1 from public.learning_courses where instructor_id = old.id)
    or exists (select 1 from public.course_rights_declarations where instructor_id = old.id)
  then
    raise exception 'Instructors with course content require managed offboarding' using errcode = '42501';
  end if;

  if exists (select 1 from public.learning_provider_organizations where created_by = old.id)
    or exists (select 1 from public.learning_provider_organization_memberships where user_id = old.id or granted_by = old.id)
    or exists (select 1 from public.learning_provider_organization_membership_events where user_id = old.id or actor_user_id = old.id)
    or exists (select 1 from public.learning_provider_organization_invitations where invited_user_id = old.id or invited_by = old.id)
    or exists (select 1 from public.learning_provider_organization_invitation_events where actor_user_id = old.id)
    or exists (select 1 from public.learning_instructor_notifications where instructor_user_id = old.id)
  then
    raise exception 'Training organization participation requires managed offboarding' using errcode = '42501';
  end if;

  select certificate_choice
  into requested_choice
  from public.learning_account_deletion_requests
  where user_id = old.id;

  requested_choice := coalesce(requested_choice, 'remove_public_verification');

  if requested_choice = 'keep_verifiable' then
    update public.certificates
    set learner_id = null,
        retention_state = 'preserved_after_account_deletion',
        account_deleted_at = now()
    where learner_id = old.id;
  else
    update public.certificates
    set learner_id = null,
        learner_name = null,
        status = 'revoked',
        revoked_at = coalesce(revoked_at, now()),
        retention_state = 'anonymized_after_account_deletion',
        account_deleted_at = now()
    where learner_id = old.id;
  end if;

  return old;
end;
$function$;

revoke all on function public.apply_learning_account_deletion_retention() from public, anon, authenticated;
grant execute on function public.apply_learning_account_deletion_retention() to postgres, service_role;
