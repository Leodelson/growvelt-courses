create or replace function public.toggle_own_learning_course_save (
  p_course_id bigint
)
  returns table (
    is_saved boolean,
    saved_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  save_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text),
    (p_course_id % 2147483647)::integer
  );

  perform 1
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.status = 'published'
  for share;

  if not found then
    raise exception 'This course is not available to save' using errcode = '22023';
  end if;

  delete from public.learning_course_saves as save_row
  where save_row.learner_id = auth.uid()
    and save_row.course_id = p_course_id
  returning save_row.saved_at into save_timestamp;

  if found then
    return query select false, null::timestamptz;
    return;
  end if;

  insert into public.learning_course_saves (learner_id, course_id)
  values (auth.uid(), p_course_id)
  returning learning_course_saves.saved_at into save_timestamp;

  return query select true, save_timestamp;
end;
$function$;

grant execute on function "public"."toggle_own_learning_course_save"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."toggle_own_learning_course_save"(bigint) from public;
