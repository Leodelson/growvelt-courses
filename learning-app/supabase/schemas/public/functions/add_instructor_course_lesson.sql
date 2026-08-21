create or replace function public.add_instructor_course_lesson (
  p_course_id        bigint,
  p_module_id        bigint,
  p_title            text,
  p_lesson_type      text,
  p_content          text,
  p_video_provider   text,
  p_video_reference  text,
  p_video_visibility text,
  p_duration_seconds integer,
  p_is_preview       boolean
)
  returns table (
    lesson_id       bigint,
    lesson_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_key bigint; next_position integer; created_id bigint; normalized_title text:=btrim(p_title); normalized_content text:=nullif(btrim(p_content),'');
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode='42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 or p_lesson_type not in ('video','text','quiz') then raise exception 'Lesson title or type is invalid' using errcode='22023'; end if;
  select course_row.id into course_key from public.learning_courses as course_row join public.course_modules as module_row on module_row.course_id=course_row.id where course_row.id=p_course_id and module_row.id=p_module_id and course_row.instructor_id=auth.uid() and course_row.status='draft';
  if course_key is null then raise exception 'Draft course or module not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select course_row.id into course_key from public.learning_courses as course_row join public.course_modules as module_row on module_row.course_id = course_row.id where course_row.id = p_course_id and module_row.id = p_module_id and course_row.instructor_id = auth.uid() and course_row.status = 'draft' and public.is_approved_growvelt_instructor();
  if course_key is null then raise exception 'Draft course or module not found' using errcode = 'P0002'; end if;
  if p_lesson_type='video' and (p_video_provider is distinct from 'youtube' or p_video_reference !~ '^[A-Za-z0-9_-]{11}$' or p_video_visibility not in ('public','unlisted') or p_duration_seconds not between 1 and 86400) then raise exception 'Videolessons require a valid YouTube reference, visibility, and duration' using errcode='22023'; end if;
  if p_lesson_type='text' and (normalized_content is null or char_length(normalized_content) not between 1 and 20000) then raise exception 'Text lessons require plain lesson content' using errcode='22023'; end if;
  select coalesce(max(lesson_row.position),0)+1 into next_position from public.lessons as lesson_row where lesson_row.course_id=course_key and lesson_row.module_id=p_module_id;
  insert into public.lessons(course_id,module_id,title,lesson_type,content,video_url,video_provider,video_reference,video_visibility,duration_seconds,duration_minutes,is_preview,position) values(course_key,p_module_id,normalized_title,p_lesson_type,case when p_lesson_type='text' then normalized_content end,null,case when p_lesson_type='video' then 'youtube' end,case when p_lesson_type='video' then p_video_reference end,case when p_lesson_type='video' then p_video_visibility end,case when p_lesson_type='video' then p_duration_seconds end,null,coalesce(p_is_preview,false),next_position) returning id into created_id;
  return query select created_id,next_position;
end; $function$;

grant execute
  on function "public"."add_instructor_course_lesson"(bigint, bigint, text, text, text, text, text, text, integer, boolean)
  to "authenticated", "postgres", "service_role";

revoke all on function "public"."add_instructor_course_lesson"(bigint, bigint, text, text, text, text, text, text, integer, boolean) from public;
