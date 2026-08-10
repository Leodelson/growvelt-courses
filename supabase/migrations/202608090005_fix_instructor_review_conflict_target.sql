-- Growvelt Learning: correct the review RPC conflict target introduced by
-- 202608090003. This is forward-only and changes no table, policy, or grant.

begin;

do $$
begin
  if to_regclass('public.account_capabilities') is null
     or to_regclass('public.instructor_profiles') is null then
    raise exception 'Instructor review RPC correction aborted: expected Learning tables are missing';
  end if;

  if to_regprocedure('public.review_instructor_application(uuid,text,text)') is null then
    raise exception 'Instructor review RPC correction aborted: expected three-argument review RPC is missing';
  end if;

  if not exists (
    select 1
    from pg_proc as routine
    where routine.oid = 'public.review_instructor_application(uuid,text,text)'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, approval_status text, instructor_capability_status text)'
  ) then
    raise exception 'Instructor review RPC correction aborted: review RPC must be SECURITY DEFINER with the expected result shape';
  end if;

  if has_function_privilege('public', 'public.review_instructor_application(uuid,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_instructor_application(uuid,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.review_instructor_application(uuid,text,text)', 'EXECUTE') then
    raise exception 'Instructor review RPC correction aborted: existing review RPC execution grants do not match the hardened baseline';
  end if;

  if not exists (
    select 1
    from pg_constraint as capability_constraint
    where capability_constraint.conrelid = 'public.account_capabilities'::regclass
      and capability_constraint.contype = 'p'
      and capability_constraint.conname = 'account_capabilities_pkey'
      and pg_get_constraintdef(capability_constraint.oid) = 'PRIMARY KEY (user_id, capability)'
  ) then
    raise exception 'Instructor review RPC correction aborted: expected account_capabilities primary-key conflict constraint is missing';
  end if;
end;
$$;

create or replace function public.review_instructor_application(
  p_application_user_id uuid,
  p_decision text,
  p_review_note text default null
)
returns table (
  user_id uuid,
  approval_status text,
  instructor_capability_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  normalized_review_note text;
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported instructor application decision' using errcode = '22023';
  end if;

  if p_review_note is not null and char_length(p_review_note) > 2000 then
    raise exception 'Review note is too long' using errcode = '22001';
  end if;
  normalized_review_note := nullif(btrim(p_review_note), '');

  select application.approval_status
    into current_status
  from public.instructor_profiles as application
  where application.user_id = p_application_user_id
  for update;

  if not found then
    raise exception 'Instructor application not found' using errcode = 'P0002';
  end if;

  if current_status <> 'pending' then
    raise exception 'Only pending instructor applications can be reviewed' using errcode = 'P0001';
  end if;

  update public.instructor_profiles
  set approval_status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = normalized_review_note,
      updated_at = now()
  where instructor_profiles.user_id = p_application_user_id;

  if p_decision = 'approved' then
    insert into public.account_capabilities as capability_record (
      user_id, capability, status, granted_at, granted_by, revoked_at, revoked_by, reason
    ) values (
      p_application_user_id, 'instructor', 'active', now(), auth.uid(), null, null, null
    )
    on conflict on constraint account_capabilities_pkey do update
      set status = 'active',
          granted_at = excluded.granted_at,
          granted_by = excluded.granted_by,
          revoked_at = null,
          revoked_by = null,
          reason = null;
  else
    update public.account_capabilities
    set status = 'revoked',
        revoked_at = now(),
        revoked_by = auth.uid(),
        reason = 'Instructor application rejected'
    where account_capabilities.user_id = p_application_user_id
      and account_capabilities.capability = 'instructor'
      and account_capabilities.status <> 'revoked';
  end if;

  return query
  select application.user_id as user_id,
         application.approval_status as approval_status,
         coalesce(capability_record.status, 'none') as instructor_capability_status
  from public.instructor_profiles as application
  left join public.account_capabilities as capability_record
    on capability_record.user_id = application.user_id
   and capability_record.capability = 'instructor'
  where application.user_id = p_application_user_id;
end;
$$;

revoke execute on function public.review_instructor_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_instructor_application(uuid, text, text) to authenticated;

commit;
