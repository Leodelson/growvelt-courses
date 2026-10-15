-- Additive, star-only feedback. Existing review records and all access/payment rules remain unchanged.
create table public.learning_course_ratings (
  course_id bigint not null references public.learning_courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (course_id, learner_id)
);
alter table public.learning_course_ratings enable row level security;
revoke all on public.learning_course_ratings from public, anon, authenticated;

create function public.rate_own_learning_course(p_course_id bigint, p_rating integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose between one and five stars' using errcode = '22023';
  end if;
  if not public.has_own_learning_course_access(auth.uid(), p_course_id)
    or not exists (select 1 from public.learning_courses c where c.id = p_course_id
      and c.instructor_id is distinct from auth.uid()) then
    raise exception 'An eligible learner enrollment is required' using errcode = '42501';
  end if;
  insert into public.learning_course_ratings(course_id, learner_id, rating)
    values (p_course_id, auth.uid(), p_rating)
    on conflict (course_id, learner_id) do update set rating = excluded.rating, updated_at = now();
end;
$$;

create function public.get_own_learning_course_rating(p_course_id bigint)
returns table(rating integer, can_rate boolean) language sql stable security definer set search_path = '' as $$
  select r.rating::integer, public.has_own_learning_course_access(auth.uid(), c.id)
    and c.instructor_id is distinct from auth.uid()
    from public.learning_courses c
    left join public.learning_course_ratings r on r.course_id = c.id and r.learner_id = auth.uid()
    where c.id = p_course_id and auth.uid() is not null
      and public.has_own_learning_course_access(auth.uid(), c.id);
$$;

-- Return only aggregates, never learner identities. Match the public catalog boundary.
create function public.list_public_learning_course_ratings(p_course_ids bigint[])
returns table(course_id bigint, average_rating numeric, rating_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(p_course_ids), 0) > 100 then
    raise exception 'Too many course references' using errcode = '22023';
  end if;
  return query select c.id, round(avg(r.rating), 1), count(r.rating)
    from public.learning_courses c
    left join public.learning_course_ratings r on r.course_id = c.id
    where c.id = any(p_course_ids) and c.status = 'published'
      and coalesce(c.company_test_mode_only, false) = false
      and (c.instructor_id is not null or c.organization_id is not null)
      and not exists (select 1 from public.learning_paystack_test_fixtures f where f.course_id = c.id)
    group by c.id;
end;
$$;
revoke all on function public.rate_own_learning_course(bigint, integer),
  public.get_own_learning_course_rating(bigint), public.list_public_learning_course_ratings(bigint[]) from public, anon, authenticated;
grant execute on function public.rate_own_learning_course(bigint, integer),
  public.get_own_learning_course_rating(bigint) to authenticated;
grant execute on function public.list_public_learning_course_ratings(bigint[]) to anon, authenticated;
