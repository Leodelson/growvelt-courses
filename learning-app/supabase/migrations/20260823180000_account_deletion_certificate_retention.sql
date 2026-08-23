-- Phase 0D: controlled account deletion and certificate retention integrity.
-- This forward-only migration preserves existing rows and changes behavior only
-- when an account/profile is explicitly deleted after deployment.

alter table public.certificates
  drop constraint certificates_learner_id_fkey;

alter table public.certificates
  alter column learner_id drop not null,
  alter column learner_name drop not null,
  add column retention_state text not null default 'account_active',
  add column account_deleted_at timestamptz,
  add constraint certificates_retention_state_check
    check (retention_state in ('account_active', 'preserved_after_account_deletion', 'anonymized_after_account_deletion')),
  add constraint certificates_retention_lifecycle_check
    check (
      (retention_state = 'account_active' and learner_id is not null and account_deleted_at is null)
      or
      (retention_state = 'preserved_after_account_deletion' and learner_id is null and learner_name is not null and account_deleted_at is not null)
      or
      (retention_state = 'anonymized_after_account_deletion' and learner_id is null and learner_name is null and account_deleted_at is not null and status = 'revoked')
    ),
  add constraint certificates_learner_id_fkey
    foreign key (learner_id) references public.profiles(id) on delete set null;

create table public.learning_account_deletion_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  certificate_choice text not null check (certificate_choice in ('keep_verifiable', 'remove_public_verification')),
  requested_at timestamptz not null default now()
);

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

create trigger apply_learning_account_deletion_retention
before delete on public.profiles
for each row execute function public.apply_learning_account_deletion_retention();

create or replace function public.delete_learning_quiz_attempts_with_enrollment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  delete from public.quiz_attempts where enrollment_id = old.id;
  return old;
end;
$function$;

revoke all on function public.delete_learning_quiz_attempts_with_enrollment() from public, anon, authenticated;
grant execute on function public.delete_learning_quiz_attempts_with_enrollment() to postgres, service_role;

create trigger delete_learning_quiz_attempts_with_enrollment
before delete on public.enrollments
for each row execute function public.delete_learning_quiz_attempts_with_enrollment();
