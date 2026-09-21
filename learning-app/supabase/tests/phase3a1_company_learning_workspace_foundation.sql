begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333601';
  employee_id uuid := '33333333-3333-4333-8333-333333333602';
  outsider_id uuid := '33333333-3333-4333-8333-333333333603';
  workspace_key bigint;
  invitation_key bigint;
  blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase3a1-owner@example.test',now(),now()),
    (employee_id,'authenticated','authenticated','phase3a1-employee@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase3a1-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase3a1-owner@example.test','Phase 3A1 Owner','complete'),
    (employee_id,'phase3a1-employee@example.test','Phase 3A1 Employee','complete'),
    (outsider_id,'phase3a1-outsider@example.test','Phase 3A1 Outsider','complete') on conflict(id) do nothing;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select workspace_id into workspace_key from public.create_own_learning_company_workspace('Phase 3A1 Test Company','phase3a1-test-company');
  if workspace_key is null or not exists(select 1 from public.learning_company_memberships where workspace_id=workspace_key and user_id=owner_id and role='owner' and status='active') then raise exception 'Company owner was not created atomically'; end if;
  select invitation_id into invitation_key from public.create_learning_company_invitation(workspace_key,'phase3a1-employee@example.test','member');
  if invitation_key is null or not exists(select 1 from public.learning_company_invitations where id=invitation_key and invited_user_id=employee_id and status='pending') then raise exception 'Company invitation was not saved'; end if;

  perform set_config('request.jwt.claim.sub',employee_id::text,true);
  perform public.respond_to_learning_company_invitation(invitation_key,'accepted');
  if not exists(select 1 from public.learning_company_memberships where workspace_id=workspace_key and user_id=employee_id and role='member' and status='active') or not exists(select 1 from public.learning_company_invitations where id=invitation_key and status='accepted') then raise exception 'Accepting company invitation did not create employee membership'; end if;
  if not exists(select 1 from public.list_own_learning_company_members(workspace_key) where member_id=owner_id) then raise exception 'Active employee could not read company roster'; end if;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin perform public.list_own_learning_company_members(workspace_key); exception when sqlstate '42501' then blocked:=true; end;
  if not blocked then raise exception 'Non-member could read company roster'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin perform public.create_own_learning_company_workspace('Second Test Company','phase3a1-second-company'); raise exception 'Second company workspace unexpectedly succeeded'; exception when sqlstate 'P0001' then null; end;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_company_workspaces','select')
    or has_table_privilege('authenticated','public.learning_company_memberships','select')
    or has_table_privilege('authenticated','public.learning_company_invitations','select') then raise exception 'Browser role can directly read company workspace tables'; end if;
end $security$;

rollback;
