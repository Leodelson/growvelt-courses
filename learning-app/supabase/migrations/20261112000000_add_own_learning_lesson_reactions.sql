-- Additive learner feedback for individual lessons. No course, enrollment,
-- payment, or existing review records are changed by this migration.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

create table public.learning_lesson_reactions (
  lesson_id bigint not null,
  course_id bigint not null,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  reaction smallint not null check (reaction in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (lesson_id, learner_id),
  foreign key (lesson_id, course_id) references public.lessons(id, course_id) on delete cascade
);

create index learning_lesson_reactions_course_reaction_idx
  on public.learning_lesson_reactions(course_id, reaction);

alter table public.learning_lesson_reactions enable row level security;
revoke all on public.learning_lesson_reactions from public, anon, authenticated;
grant all on public.learning_lesson_reactions to service_role;

create function public.get_own_learning_lesson_reaction(p_lesson_id bigint)
returns smallint
language sql stable security definer set search_path = '' as $$
  select reaction_row.reaction
  from public.learning_lesson_reactions reaction_row
  join public.lessons lesson_row
    on lesson_row.id = reaction_row.lesson_id and lesson_row.course_id = reaction_row.course_id
  join public.learning_courses course_row on course_row.id = lesson_row.course_id
  where reaction_row.lesson_id = p_lesson_id
    and reaction_row.learner_id = auth.uid()
    and auth.uid() is not null
    and course_row.instructor_id is distinct from auth.uid()
    and public.has_own_learning_course_access(auth.uid(), course_row.id);
$$;

create function public.toggle_own_learning_lesson_reaction(p_lesson_id bigint, p_reaction smallint)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  learner uuid := auth.uid();
  course_key bigint;
  saved_reaction smallint;
begin
  if learner is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_lesson_id is null or p_lesson_id < 1 or p_reaction is null or p_reaction not in (-1, 1) then
    raise exception 'Choose a valid lesson reaction' using errcode = '22023';
  end if;

  select lesson_row.course_id into course_key
  from public.lessons lesson_row
  join public.learning_courses course_row on course_row.id = lesson_row.course_id
  where lesson_row.id = p_lesson_id
    and course_row.instructor_id is distinct from learner;

  if course_key is null or not public.has_own_learning_course_access(learner, course_key) then
    raise exception 'An eligible learner enrollment is required' using errcode = '42501';
  end if;

  insert into public.learning_lesson_reactions(lesson_id, course_id, learner_id, reaction)
    values (p_lesson_id, course_key, learner, p_reaction)
    on conflict (lesson_id, learner_id) do update
      set reaction = case
        when public.learning_lesson_reactions.reaction = excluded.reaction then null
        else excluded.reaction
      end,
      updated_at = now()
    returning reaction into saved_reaction;

  if saved_reaction is null then
    delete from public.learning_lesson_reactions
    where lesson_id = p_lesson_id and learner_id = learner;
  end if;
  return saved_reaction;
end;
$$;

revoke all on function public.get_own_learning_lesson_reaction(bigint),
  public.toggle_own_learning_lesson_reaction(bigint, smallint) from public, anon, authenticated;
grant execute on function public.get_own_learning_lesson_reaction(bigint),
  public.toggle_own_learning_lesson_reaction(bigint, smallint) to authenticated;

commit;
