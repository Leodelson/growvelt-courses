-- Marketing consent is Learning-specific and defaults to off.
create table public.learning_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_opt_in boolean not null default false,
  changed_at timestamptz not null default now(),
  unsubscribe_token uuid not null unique default gen_random_uuid()
);
alter table public.learning_email_preferences enable row level security;
create policy "Read own Learning email preference" on public.learning_email_preferences
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.learning_email_preferences to authenticated;
grant all on public.learning_email_preferences to service_role;

create table public.learning_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  audience text not null check (audience in ('learners','instructors','organizations')),
  subject text not null check (char_length(subject) between 3 and 160),
  headline text not null check (char_length(headline) between 3 and 160),
  body text not null check (char_length(body) between 10 and 4000),
  status text not null default 'draft' check (status in ('draft','sending','sent','partial','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_count integer not null default 0,
  failed_count integer not null default 0
);
alter table public.learning_email_campaigns enable row level security;
grant all on public.learning_email_campaigns to service_role;

create table public.learning_email_deliveries (
  campaign_id uuid not null references public.learning_email_campaigns(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('claimed','accepted','failed','skipped')),
  provider_message_id text,
  attempted_at timestamptz not null default now(),
  primary key (campaign_id,user_id)
);
alter table public.learning_email_deliveries enable row level security;
grant all on public.learning_email_deliveries to service_role;

-- A service-only token lookup is used by the one-click unsubscribe confirmation.
create index learning_email_preferences_opt_in_idx on public.learning_email_preferences (marketing_opt_in,user_id);

create function public.learning_marketing_recipients(p_audience text, p_campaign_id uuid, p_limit integer default 10)
returns table(user_id uuid, email text, unsubscribe_token uuid)
language sql security definer set search_path = '' as $$
  select p.user_id, u.email::text, p.unsubscribe_token
  from public.learning_email_preferences p
  join auth.users u on u.id = p.user_id
  join public.profiles profile on profile.id = p.user_id
  where p.marketing_opt_in = true and u.email is not null
    and (p_campaign_id is null or not exists (
      select 1 from public.learning_email_deliveries d
      where d.campaign_id = p_campaign_id and d.user_id = p.user_id
    ))
    and (
      (p_audience = 'learners' and profile.account_type = 'learner')
      or (p_audience = 'instructors' and exists (
        select 1 from public.instructor_profiles i
        where i.user_id = p.user_id and i.approval_status = 'approved'
      ))
      or (p_audience = 'organizations' and exists (
        select 1 from public.learning_company_memberships m
        join public.learning_company_workspaces w on w.id = m.workspace_id
        where m.user_id = p.user_id and m.status = 'active'
          and m.role in ('owner','admin') and w.status = 'active'
      ))
    )
  order by p.user_id
  limit least(greatest(p_limit, 1), 3);
$$;
revoke all on function public.learning_marketing_recipients(text,uuid,integer) from public, anon, authenticated;
grant execute on function public.learning_marketing_recipients(text,uuid,integer) to service_role;

create function public.learning_marketing_recipient_count(p_audience text)
returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.learning_email_preferences p
  join auth.users u on u.id = p.user_id
  join public.profiles profile on profile.id = p.user_id
  where p.marketing_opt_in = true and u.email is not null
    and (
      (p_audience = 'learners' and profile.account_type = 'learner')
      or (p_audience = 'instructors' and exists (
        select 1 from public.instructor_profiles i where i.user_id = p.user_id and i.approval_status = 'approved'
      ))
      or (p_audience = 'organizations' and exists (
        select 1 from public.learning_company_memberships m
        join public.learning_company_workspaces w on w.id = m.workspace_id
        where m.user_id = p.user_id and m.status = 'active' and m.role in ('owner','admin') and w.status = 'active'
      ))
    );
$$;
revoke all on function public.learning_marketing_recipient_count(text) from public, anon, authenticated;
grant execute on function public.learning_marketing_recipient_count(text) to service_role;
