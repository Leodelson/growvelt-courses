-- Learning-only sign-in history and notification receipts. Careers remains separate.
create table if not exists public.learning_login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sign_in_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  browser text not null,
  device text not null,
  country text,
  unique (user_id, sign_in_at)
);

create index if not exists learning_login_activity_owner_recent_idx
  on public.learning_login_activity (user_id, sign_in_at desc);

alter table public.learning_login_activity enable row level security;
create policy "Learners read own sign-in activity" on public.learning_login_activity
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.learning_login_activity to authenticated;
grant all on public.learning_login_activity to service_role;

create table if not exists public.learning_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('login', 'course', 'certificate', 'review', 'support', 'announcement')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  source_key text,
  unique (user_id, source_key)
);

create index if not exists learning_notifications_owner_recent_idx
  on public.learning_notifications (user_id, created_at desc);

alter table public.learning_notifications enable row level security;
create policy "Learners read own notifications" on public.learning_notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Learners mark own notifications read" on public.learning_notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select on public.learning_notifications to authenticated;
grant update (read_at) on public.learning_notifications to authenticated;
grant all on public.learning_notifications to service_role;
