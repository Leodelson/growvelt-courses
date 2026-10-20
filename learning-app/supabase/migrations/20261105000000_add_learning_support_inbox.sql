-- Learning-only human support conversations. No Careers Auth or tables are shared.
create table public.learning_support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic in ('courses','billing','teaching','organizations','account','other')),
  subject text not null check (char_length(subject) between 5 and 160),
  status text not null default 'open' check (status in ('open','waiting','resolved')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index learning_support_owner_idx on public.learning_support_conversations(user_id,updated_at desc);
create index learning_support_inbox_idx on public.learning_support_conversations(status,last_message_at desc);
alter table public.learning_support_conversations enable row level security;
create policy "Own or admin Learning support cases" on public.learning_support_conversations
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_growvelt_learning_admin()));
grant select on public.learning_support_conversations to authenticated;
grant all on public.learning_support_conversations to service_role;

create table public.learning_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.learning_support_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','support')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index learning_support_messages_thread_idx on public.learning_support_messages(conversation_id,created_at,id);
alter table public.learning_support_messages enable row level security;
create policy "Own or admin Learning support messages" on public.learning_support_messages
  for select to authenticated using (exists (
    select 1 from public.learning_support_conversations c
    where c.id = conversation_id and (c.user_id = (select auth.uid()) or (select public.is_growvelt_learning_admin()))
  ));
grant select on public.learning_support_messages to authenticated;
grant all on public.learning_support_messages to service_role;

create function public.create_learning_support_case(p_topic text,p_subject text,p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_topic not in ('courses','billing','teaching','organizations','account','other')
     or char_length(btrim(coalesce(p_subject,''))) not between 5 and 160
     or char_length(btrim(coalesce(p_message,''))) not between 20 and 5000 then
    raise exception 'Invalid support request' using errcode = '22023';
  end if;
  if (select count(*) from public.learning_support_conversations
      where user_id = v_user and status <> 'resolved' and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many open support requests' using errcode = '22023';
  end if;
  insert into public.learning_support_conversations(user_id,topic,subject)
    values (v_user,p_topic,btrim(p_subject)) returning id into v_id;
  insert into public.learning_support_messages(conversation_id,sender_user_id,sender_role,body)
    values (v_id,v_user,'customer',btrim(p_message));
  return v_id;
end;
$$;
revoke all on function public.create_learning_support_case(text,text,text) from public, anon;
grant execute on function public.create_learning_support_case(text,text,text) to authenticated;

create function public.post_learning_support_message(p_conversation_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_is_admin boolean; v_id uuid;
begin
  if v_user is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_message,''))) not between 1 and 5000 then
    raise exception 'Invalid message' using errcode = '22023';
  end if;
  select user_id into v_owner from public.learning_support_conversations
    where id = p_conversation_id for update;
  if v_owner is null then raise exception 'Support case not found' using errcode = '42501'; end if;
  v_is_admin := public.is_growvelt_learning_admin();
  if v_owner <> v_user and not v_is_admin then raise exception 'Not authorized' using errcode = '42501'; end if;
  if (select count(*) from public.learning_support_messages
      where conversation_id = p_conversation_id and sender_user_id = v_user
        and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Please wait before sending another message' using errcode = '22023';
  end if;
  insert into public.learning_support_messages(conversation_id,sender_user_id,sender_role,body)
    values (p_conversation_id,v_user,case when v_is_admin then 'support' else 'customer' end,btrim(p_message))
    returning id into v_id;
  update public.learning_support_conversations set
    status = case when v_is_admin then 'waiting' else 'open' end,
    assigned_admin_id = case when v_is_admin then v_user else assigned_admin_id end,
    updated_at = now(), last_message_at = now()
    where id = p_conversation_id;
  if v_is_admin and v_owner <> v_user then
    insert into public.learning_notifications(user_id,kind,title,body,href,source_key)
      values (v_owner,'support','Support replied to your request',left(btrim(p_message),180),
        '/dashboard/support/' || p_conversation_id::text,'support:' || v_id::text);
  end if;
  return v_id;
end;
$$;
revoke all on function public.post_learning_support_message(uuid,text) from public, anon;
grant execute on function public.post_learning_support_message(uuid,text) to authenticated;

create function public.resolve_learning_support_case(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_growvelt_learning_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.learning_support_conversations
    set status = 'resolved', updated_at = now(), assigned_admin_id = auth.uid()
    where id = p_conversation_id;
  if not found then raise exception 'Support case not found' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.resolve_learning_support_case(uuid) from public, anon;
grant execute on function public.resolve_learning_support_case(uuid) to authenticated;
