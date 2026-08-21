create or replace function public.update_instructor_course_lesson (
  p_lesson_id        bigint,
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
    lesson_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_key bigint; normalized_title text:=btrim(p_title); normalized_content text:=nullif(btrim(p_content),'');
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode='42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 or p_lesson_type not in ('video','text','quiz') then raise exception 'Lesson title or type is invalid' using errcode='22023'; end if;
  select course_row.id into course_key from public.lessons as lesson_row join public.learning_courses as course_row on course_row.id=lesson_row.course_id join public.course_modules as module_row on module_row.id=p_module_id and module_row.course_id=course_row.id where lesson_row.id=p_lesson_id and course_row.instructor_id=auth.uid() and course_row.status='draft';
  if course_key is null then raise exception 'Draft lesson or module not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select course_row.id into course_key from public.lessons as lesson_row join public.learning_courses as course_row on course_row.id = lesson_row.course_id join public.course_modules as module_row on module_row.id = p_module_id and module_row.course_id = course_row.id where lesson_row.id = p_lesson_id and course_row.instructor_id = auth.uid() and course_row.status = 'draft' and public.is_approved_growvelt_instructor();
  if course_key is null then raise exception 'Draft lesson or module not found' using errcode = 'P0002'; end if;
  if p_lesson_type <> 'quiz' and exists (select 1 from public.quiz_lessons as quiz_row join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id where quiz_row.lesson_id = p_lesson_id) then raise exception 'A quiz with learner attempts cannot be converted' using errcode = '22023'; end if;
  if p_lesson_type <> 'quiz' then delete from public.quiz_lessons as quiz_row where quiz_row.lesson_id = p_lesson_id; end if;
  if p_lesson_type='video' and (p_video_provider is distinct from 'youtube' or p_video_reference !~ '^[A-Za-z0-9_-]{11}$' or p_video_visibility not in ('public','unlisted') or p_duration_seconds not between 1 and 86400) then raise exception 'Videolessons require a valid YouTube reference, visibility, and duration' using errcode='22023'; end if;
  if p_lesson_type='text' and (normalized_content is null or char_length(normalized_content) not between 1 and 20000) then raise exception 'Text lessons require plain lesson content' using errcode='22023'; end if;
  update public.lessons as lesson_row set module_id=p_module_id,title=normalized_title,lesson_type=p_lesson_type,content=case when p_lesson_type='text' then normalized_content end,video_url=null,video_provider=case when p_lesson_type='video' then 'youtube' end,video_reference=case when p_lesson_type='video' then p_video_reference end,video_visibility=case when p_lesson_type='video' then p_video_visibility end,duration_seconds=case when p_lesson_type='video' then p_duration_seconds end,duration_minutes=null,is_preview=coalesce(p_is_preview,false),updated_at=now() where lesson_row.id=p_lesson_id and lesson_row.course_id=course_key;
  return query select p_lesson_id;
end; $function$;

grant execute
  on function "public"."update_instructor_course_lesson"(bigint, bigint, text, text, text, text, text, text, integer, boolean)
  to "authenticated", "postgres", "service_role";

revoke all on function "public"."update_instructor_course_lesson"(bigint, bigint, text, text, text, text, text, text, integer, boolean) from public;
