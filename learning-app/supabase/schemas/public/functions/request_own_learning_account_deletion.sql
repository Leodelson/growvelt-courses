create or replace function public.request_own_learning_account_deletion(p_certificate_choice text)
returns table (outcome text, certificate_count integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare own_user_id uuid := auth.uid(); own_certificate_count integer;
begin
  if own_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_certificate_choice not in ('keep_verifiable','remove_public_verification') then raise exception 'Choose how earned certificates should be handled' using errcode='22023'; end if;
  perform 1 from public.profiles where id=own_user_id for update;
  if not found then raise exception 'Learning profile not found' using errcode='P0002'; end if;
  select count(*)::integer into own_certificate_count from public.certificates where learner_id=own_user_id;
  if exists(select 1 from public.account_capabilities where user_id=own_user_id and capability='admin' and status='active') then return query select 'admin_offboarding_required'::text,own_certificate_count; return; end if;
  if exists(select 1 from public.learning_courses where instructor_id=own_user_id) or exists(select 1 from public.course_rights_declarations where instructor_id=own_user_id) then return query select 'instructor_offboarding_required'::text,own_certificate_count; return; end if;
  insert into public.learning_account_deletion_requests(user_id,certificate_choice,requested_at) values(own_user_id,p_certificate_choice,now()) on conflict(user_id) do update set certificate_choice=excluded.certificate_choice,requested_at=excluded.requested_at;
  return query select 'ready'::text,own_certificate_count;
end;
$function$;

grant execute on function "public"."request_own_learning_account_deletion"(text) to "authenticated", "postgres", "service_role";
revoke all on function "public"."request_own_learning_account_deletion"(text) from public, "anon";
