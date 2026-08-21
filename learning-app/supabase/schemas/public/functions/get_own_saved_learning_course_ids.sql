create or replace function public.get_own_saved_learning_course_ids()
  returns table (
    course_id bigint
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select save_row.course_id
  from public.learning_course_saves as save_row
  join public.learning_courses as course_row
    on course_row.id = save_row.course_id
    and course_row.status = 'published'
  where save_row.learner_id = auth.uid()
  order by save_row.saved_at desc, save_row.course_id desc;
end;
$function$;

grant execute on function "public"."get_own_saved_learning_course_ids"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_saved_learning_course_ids"() from public;
