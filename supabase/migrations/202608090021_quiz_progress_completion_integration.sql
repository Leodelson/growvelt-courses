
-- Growvelt Learning Phase 2C-A2: quiz progress, completion, and submission safety.
-- Forward-only. Project lessons remain visible but are not progress eligible.

begin;

do $$
begin
  if to_regclass('public.quiz_lessons') is null
    or to_regclass('public.quiz_questions') is null
    or to_regclass('public.quiz_options') is null
    or to_regclass('public.quiz_attempts') is null
    or to_regclass('public.enrollments') is null
    or to_regclass('public.lesson_progress') is null then
    raise exception 'Quiz integration aborted: expected Phase 2B/2C assessment relations are missing';
  end if;
  if to_regprocedure('public.submit_own_quiz_attempt(text,bigint,jsonb)') is null
    or to_regprocedure('public.complete_own_enrolled_lesson(bigint,bigint)') is null
    or to_regprocedure('public.list_own_learning_course_experience(integer,integer)') is null
    or to_regprocedure('public.get_own_enrolled_learning_course_experience_by_slug(text)') is null
    or to_regprocedure('public.get_own_enrolled_lesson_snapshot(text,bigint)') is null
    or to_regprocedure('public.get_own_learning_certificate_state(bigint)') is null
    or to_regprocedure('public.issue_own_learning_certificate(bigint)') is null then
    raise exception 'Quiz integration aborted: expected hardened Learning RPC baseline is missing';
  end if;
  if to_regprocedure('public.recompute_learning_enrollment_completion(bigint)') is not null
    or to_regprocedure('public.validate_learning_course_quiz_readiness()') is not null then
    raise exception 'Quiz integration aborted: expected clean Phase 2C-A2 state is missing';
  end if;
  if exists (select 1 from pg_trigger as trigger_row where trigger_row.tgrelid = 'public.learning_courses'::regclass and trigger_row.tgname = 'learning_courses_quiz_readiness_before_submit' and not trigger_row.tgisinternal) then
    raise exception 'Quiz integration aborted: quiz-readiness trigger already exists';
  end if;
  if exists (select 1 from public.learning_courses as course_row join public.lessons as lesson_row on lesson_row.course_id = course_row.id and lesson_row.lesson_type = 'quiz' left join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id where course_row.status = 'published' and (quiz_row.id is null or quiz_row.passing_percentage not between 1 and 100 or not exists (select 1 from public.quiz_questions as question_row where question_row.quiz_id = quiz_row.id) or exists (select 1 from public.quiz_questions as question_row left join public.quiz_options as option_row on option_row.question_id = question_row.id where question_row.quiz_id = quiz_row.id group by question_row.id having count(option_row.id) not between 2 and 6 or count(option_row.id) filter (where option_row.is_correct) <> 1))) then
    raise exception 'Quiz integration aborted: a published quiz lesson is structurally incomplete';
  end if;
end;
$$;

-- One internal source of truth. A text/video activity uses lesson_progress;
-- a quiz activity is complete only if its enrollment has a passed attempt.
create function public.recompute_learning_enrollment_completion(p_enrollment_id bigint)
returns table (completed_lessons integer, total_lessons integer, progress_percent integer, enrollment_status text, enrollment_completed_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  course_key bigint;
  current_status text;
  total_count integer;
  done_count integer;
begin
  select enrollment_row.course_id, enrollment_row.status
  into course_key, current_status
  from public.enrollments as enrollment_row
  where enrollment_row.id = p_enrollment_id
  for update;
  if course_key is null or current_status = 'cancelled' then
    raise exception 'Enrollment is not active' using errcode = '42501';
  end if;

  with activities as (
    select lesson_row.id,
      case
        when lesson_row.lesson_type in ('text', 'video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent = 100, false)
        when lesson_row.lesson_type = 'quiz' then exists (
          select 1 from public.quiz_lessons as quiz_row
          join public.quiz_attempts as attempt_row on attempt_row.quiz_id = quiz_row.id
          where quiz_row.lesson_id = lesson_row.id
            and attempt_row.enrollment_id = p_enrollment_id
            and attempt_row.passed = true
        )
        else false
      end as is_complete
    from public.course_modules as module_row
    join public.lessons as lesson_row on lesson_row.course_id = module_row.course_id and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row on progress_row.enrollment_id = p_enrollment_id and progress_row.lesson_id = lesson_row.id
    where module_row.course_id = course_key
      and lesson_row.lesson_type in ('text', 'video', 'quiz')
  )
  select count(*)::integer, count(*) filter (where activities.is_complete)::integer
  into total_count, done_count
  from activities;

  if total_count > 0 and done_count = total_count and current_status = 'active' then
    update public.enrollments as enrollment_row
    set status = 'completed', completed_at = coalesce(enrollment_row.completed_at, now())
    where enrollment_row.id = p_enrollment_id and enrollment_row.status = 'active';
  end if;

  return query
  select done_count,
         total_count,
         case when total_count = 0 then 0 else least(100, (done_count * 100) / total_count) end,
         enrollment_row.status,
         enrollment_row.completed_at
  from public.enrollments as enrollment_row
  where enrollment_row.id = p_enrollment_id;
end;
$$;

-- Submission validation is a database boundary: draft -> pending_review cannot
-- bypass structurally incomplete quizzes, even outside the normal submission RPC.
create function public.validate_learning_course_quiz_readiness()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'pending_review' and exists (
    select 1
    from public.lessons as lesson_row
    left join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
    left join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
    left join public.quiz_options as option_row on option_row.question_id = question_row.id
    where lesson_row.course_id = new.id
      and lesson_row.lesson_type = 'quiz'
    group by lesson_row.id, quiz_row.id, quiz_row.passing_percentage, question_row.id
    having quiz_row.id is null
      or quiz_row.passing_percentage not between 1 and 100
      or question_row.id is null
      or count(option_row.id) not between 2 and 6
      or count(option_row.id) filter (where option_row.is_correct) <> 1
  ) then
    raise exception 'Quiz assessment is incomplete and cannot be submitted for review' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger learning_courses_quiz_readiness_before_submit
before update of status on public.learning_courses
for each row execute function public.validate_learning_course_quiz_readiness();

-- Preserve the Phase 2A-B lesson RPC contracts while permitting draft quiz
-- lesson shells. Configuration/questions remain separate restricted RPCs.
create or replace function public.add_instructor_course_lesson(p_course_id bigint, p_module_id bigint, p_title text, p_lesson_type text, p_content text, p_video_provider text, p_video_reference text, p_video_visibility text, p_duration_seconds integer, p_is_preview boolean)
returns table (lesson_id bigint, lesson_position integer)
language plpgsql security definer set search_path = '' as $$
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
end; $$;

create or replace function public.update_instructor_course_lesson(p_lesson_id bigint, p_module_id bigint, p_title text, p_lesson_type text, p_content text, p_video_provider text, p_video_reference text, p_video_visibility text, p_duration_seconds integer, p_is_preview boolean)
returns table (lesson_id bigint)
language plpgsql security definer set search_path = '' as $$
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
end; $$;

create or replace function public.complete_own_enrolled_lesson(p_course_id bigint, p_lesson_id bigint)
returns table (completed_lesson_id bigint, completed_at timestamptz, progress_percent integer)
language plpgsql security definer set search_path = ''
as $$
declare own_enrollment_id bigint; completion_time timestamptz; completion_percent integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select enrollment_row.id into own_enrollment_id
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  join public.lessons as lesson_row on lesson_row.id = p_lesson_id and lesson_row.course_id = course_row.id and lesson_row.lesson_type in ('text', 'video')
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active', 'completed') and course_row.id = p_course_id
  for update of enrollment_row, course_row, lesson_row;
  if own_enrollment_id is null then raise exception 'This lesson is not available to this account' using errcode = '42501';end if;
  insert into public.lesson_progress as progress_row (enrollment_id, lesson_id, completed_at, progress_percent)
  values (own_enrollment_id, p_lesson_id, now(), 100)
  on conflict (enrollment_id, lesson_id) do update set completed_at = coalesce(progress_row.completed_at, excluded.completed_at), progress_percent = 100
  returning progress_row.completed_at into completion_time;
  perform public.recompute_learning_enrollment_completion(own_enrollment_id);
  completion_percent := 100;
  return query select p_lesson_id, completion_time, completion_percent;
end;
$$;

create or replace function public.submit_own_quiz_attempt(p_slug text, p_lesson_id bigint, p_answers jsonb)
returns table (attempt_id bigint, submitted_at timestamptz, score_percentage integer, passed boolean, correct_answer_count integer, total_question_count integer)
language plpgsql security definer set search_path = ''
as $$
declare normalized_slug text := lower(btrim(p_slug)); own_enrollment_id bigint; own_course_id bigint; quiz_key bigint; passing_mark integer; question_total integer; submitted_total integer; distinct_questions integer; correct_total integer; calculated_score integer; created_attempt_id bigint; created_submitted_at timestamptz; calculated_passed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid course reference' using errcode = '22023'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Quiz answers must be an array' using errcode = '22023'; end if;
  select enrollment_row.id, course_row.id, quiz_row.id, quiz_row.passing_percentage into own_enrollment_id, own_course_id, quiz_key, passing_mark
  from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published' join public.lessons as lesson_row on lesson_row.id = p_lesson_id and lesson_row.course_id = course_row.id and lesson_row.lesson_type = 'quiz' join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status in ('active', 'completed') and course_row.slug = normalized_slug
  for update of enrollment_row, course_row, lesson_row, quiz_row;
  if quiz_key is null then raise exception 'This quiz is not available to this account' using errcode = '42501'; end if;
  if exists (select 1 from public.quiz_questions as readiness_question left join public.quiz_options as readiness_option on readiness_option.question_id = readiness_question.id where readiness_question.quiz_id = quiz_key group by readiness_question.id having count(readiness_option.id) not between 2 and 6 or count(readiness_option.id) filter (where readiness_option.is_correct) <> 1) or not exists (select 1 from public.quiz_questions as readiness_question where readiness_question.quiz_id = quiz_key) then raise exception 'Quiz configuration is incomplete' using errcode = '22023'; end if;
  if exists (
    select 1
    from public.quiz_questions as readiness_question
    left join public.quiz_options as readiness_option on readiness_option.question_id = readiness_question.id
    where readiness_question.quiz_id = quiz_key
    group by readiness_question.id
    having count(readiness_option.id) not between 2 and 6
       or count(readiness_option.id) filter (where readiness_option.is_correct) <> 1
  ) or not exists (select 1 from public.quiz_questions as readiness_question where readiness_question.quiz_id = quiz_key) then
    raise exception 'Quiz configuration is incomplete' using errcode = '22023';
  end if;
  with submitted_answers as (select case when jsonb_typeof(item.value)='object' and (item.value->>'question_id') ~ '^[1-9][0-9]*$' then (item.value->>'question_id')::bigint end as question_id, case when jsonb_typeof(item.value)='object' and (item.value->>'option_id') ~ '^[1-9][0-9]*$' then (item.value->>'option_id')::bigint end as option_id from jsonb_array_elements(p_answers) as item(value)) select count(*)::integer,count(distinct question_id)::integer into submitted_total,distinct_questions from submitted_answers;
  select count(*)::integer into question_total from public.quiz_questions as question_row where question_row.quiz_id=quiz_key;
  if question_total < 1 or submitted_total <> question_total or distinct_questions <> question_total then raise exception 'Answer every quiz question exactly once' using errcode='22023'; end if;
  if exists (with submitted_answers as (select case when jsonb_typeof(item.value) = 'object' and (item.value->>'question_id') ~ '^[1-9][0-9]*$' then (item.value->>'question_id')::bigint end as question_id, case when jsonb_typeof(item.value) = 'object' and (item.value->>'option_id') ~ '^[1-9][0-9]*$' then (item.value->>'option_id')::bigint end as option_id from jsonb_array_elements(p_answers) as item(value)) select 1 from submitted_answers left join public.quiz_questions as question_row on question_row.id = submitted_answers.question_id and question_row.quiz_id = quiz_key left join public.quiz_options as option_row on option_row.id = submitted_answers.option_id and option_row.question_id = question_row.id where submitted_answers.question_id is null or submitted_answers.option_id is null or question_row.id is null or option_row.id is null) then raise exception 'Quiz answers do not match this assessment' using errcode='22023'; end if;
  with submitted_answers as (select case when jsonb_typeof(item.value) = 'object' and (item.value->>'question_id') ~ '^[1-9][0-9]*$' then (item.value->>'question_id')::bigint end as question_id, case when jsonb_typeof(item.value) = 'object' and (item.value->>'option_id') ~ '^[1-9][0-9]*$' then (item.value->>'option_id')::bigint end as option_id from jsonb_array_elements(p_answers) as item(value)) select count(*) filter(where option_row.is_correct)::integer into correct_total from submitted_answers join public.quiz_options as option_row on option_row.id = submitted_answers.option_id and option_row.question_id = submitted_answers.question_id;
  calculated_score:=floor((correct_total::numeric*100)/question_total)::integer; calculated_passed:=calculated_score>=passing_mark;
  insert into public.quiz_attempts(quiz_id,enrollment_id,learner_id,course_id,correct_answer_count,total_question_count,score_percentage,passed) values(quiz_key,own_enrollment_id,auth.uid(),own_course_id,correct_total,question_total,calculated_score,calculated_passed) returning id,submitted_at into created_attempt_id,created_submitted_at;
  insert into public.quiz_attempt_answers(attempt_id,quiz_id,question_id,selected_option_id) select created_attempt_id,quiz_key,case when jsonb_typeof(item.value) = 'object' and (item.value->>'question_id') ~ '^[1-9][0-9]*$' then (item.value->>'question_id')::bigint end,case when jsonb_typeof(item.value) = 'object' and (item.value->>'option_id') ~ '^[1-9][0-9]*$' then (item.value->>'option_id')::bigint end from jsonb_array_elements(p_answers) as item(value);
  perform public.recompute_learning_enrollment_completion(own_enrollment_id);
  return query select created_attempt_id,created_submitted_at,calculated_score,calculated_passed,correct_total,question_total;
end;
$$;

-- Existing learner experience RPC contracts are retained. The eligible-state
-- CTE counts passed quizzes without returning answer keys.
create or replace function public.list_own_learning_course_experience(p_limit integer default 24, p_offset integer default 0)
returns table (course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz, enrollment_status text, completed_lessons integer, total_lessons integer, progress_percent integer, resume_lesson_id bigint)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then raise exception 'Invalid pagination' using errcode='22023'; end if;
  return query with own_enrollments as (select enrollment_row.id,enrollment_row.course_id,enrollment_row.enrolled_at,enrollment_row.status from public.enrollments as enrollment_row where enrollment_row.learner_id=auth.uid() and enrollment_row.status in ('active','completed')), activities as (select enrollment_row.id as enrollment_id,lesson_row.id as lesson_id,module_row.position as module_position,module_row.id as module_id,lesson_row.position as lesson_position,lesson_row.lesson_type,case when lesson_row.lesson_type in ('text','video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent=100,false) when lesson_row.lesson_type='quiz' then exists(select 1 from public.quiz_lessons as quiz_row join public.quiz_attempts as attempt_row on attempt_row.quiz_id=quiz_row.id where quiz_row.lesson_id=lesson_row.id and attempt_row.enrollment_id=enrollment_row.id and attempt_row.passed) else false end as is_complete from own_enrollments as enrollment_row join public.course_modules as module_row on module_row.course_id=enrollment_row.course_id join public.lessons as lesson_row on lesson_row.course_id=enrollment_row.course_id and lesson_row.module_id=module_row.id and lesson_row.lesson_type in ('text','video','quiz') left join public.lesson_progress as progress_row on progress_row.enrollment_id=enrollment_row.id and progress_row.lesson_id=lesson_row.id), totals as (select enrollment_id,count(*)::integer as total_lessons,count(*) filter(where is_complete)::integer as completed_lessons from activities group by enrollment_id), resume as (select distinct on (enrollment_id) enrollment_id,lesson_id from activities where not is_complete order by enrollment_id,module_position,module_id,lesson_position,lesson_id) select course_row.id,course_row.slug,course_row.title,course_row.summary,course_row.category,course_row.level,course_row.is_free,profile_row.full_name,enrollment_row.enrolled_at,enrollment_row.status,coalesce(totals.completed_lessons,0),coalesce(totals.total_lessons,0),case when coalesce(totals.total_lessons,0)=0 then 0 else least(100,(coalesce(totals.completed_lessons,0)*100)/totals.total_lessons) end,resume.lesson_id from own_enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' left join public.profiles as profile_row on profile_row.id=course_row.instructor_id left join totals on totals.enrollment_id=enrollment_row.id left join resume on resume.enrollment_id=enrollment_row.id order by enrollment_row.enrolled_at desc,course_row.id desc limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_own_enrolled_learning_course_experience_by_slug(p_slug text)
returns table (course_id bigint, slug text, course_title text, summary text, description text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz, enrollment_status text, enrollment_completed_at timestamptz, completed_lessons integer, total_lessons integer, progress_percent integer, resume_lesson_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_completed boolean, is_preview boolean)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return query with enrolled_course as (select enrollment_row.id as enrollment_id,enrollment_row.enrolled_at,enrollment_row.status,enrollment_row.completed_at,course_row.id,course_row.slug,course_row.title,course_row.summary,course_row.description,course_row.category,course_row.level,course_row.is_free,profile_row.full_name from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' left join public.profiles as profile_row on profile_row.id=course_row.instructor_id where enrollment_row.learner_id=auth.uid() and enrollment_row.status in ('active','completed') and course_row.slug=lower(btrim(p_slug))), rows as (select enrolled_course.enrollment_id,lesson_row.id,lesson_row.lesson_type,module_row.position as module_position,module_row.id as source_module_id,lesson_row.position as lesson_position,case when lesson_row.lesson_type in ('text','video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent=100,false) when lesson_row.lesson_type='quiz' then exists(select 1 from public.quiz_lessons as quiz_row join public.quiz_attempts as attempt_row on attempt_row.quiz_id=quiz_row.id where quiz_row.lesson_id=lesson_row.id and attempt_row.enrollment_id=enrolled_course.enrollment_id and attempt_row.passed) else false end as is_complete from enrolled_course join public.course_modules as module_row on module_row.course_id=enrolled_course.id join public.lessons as lesson_row on lesson_row.course_id=enrolled_course.id and lesson_row.module_id=module_row.id left join public.lesson_progress as progress_row on progress_row.enrollment_id=enrolled_course.enrollment_id and progress_row.lesson_id=lesson_row.id), totals as (select enrollment_id,count(*) filter(where lesson_type in ('text','video','quiz'))::integer as total_lessons,count(*) filter(where lesson_type in ('text','video','quiz') and is_complete)::integer as completed_lessons from rows group by enrollment_id), resume as (select distinct on (enrollment_id) enrollment_id,id as lesson_id from rows where lesson_type in ('text','video','quiz') and not is_complete order by enrollment_id,module_position,source_module_id,lesson_position,id) select enrolled_course.id,enrolled_course.slug,enrolled_course.title,enrolled_course.summary,enrolled_course.description,enrolled_course.category,enrolled_course.level,enrolled_course.is_free,enrolled_course.full_name,enrolled_course.enrolled_at,enrolled_course.status,enrolled_course.completed_at,coalesce(totals.completed_lessons,0),coalesce(totals.total_lessons,0),case when coalesce(totals.total_lessons,0)=0 then 0 else least(100,(coalesce(totals.completed_lessons,0)*100)/totals.total_lessons) end,resume.lesson_id,module_row.id,module_row.title,module_row.position,lesson_row.id,lesson_row.title,lesson_row.lesson_type,coalesce(rows.is_complete,false),lesson_row.is_preview from enrolled_course left join totals on totals.enrollment_id=enrolled_course.enrollment_id left join resume on resume.enrollment_id=enrolled_course.enrollment_id left join public.course_modules as module_row on module_row.course_id=enrolled_course.id left join public.lessons as lesson_row on lesson_row.course_id=enrolled_course.id and lesson_row.module_id=module_row.id left join rows on rows.id=lesson_row.id and rows.enrollment_id=enrolled_course.enrollment_id order by module_row.position,module_row.id,lesson_row.position,lesson_row.id;
end;
$$;

create or replace function public.get_own_learning_certificate_state(p_course_id bigint)
returns table (is_eligible boolean, certificate_code text, certificate_status text)
language plpgsql security definer stable set search_path='' as $$ declare eligible_count integer; done_count integer; begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; select count(lesson_row.id)::integer,count(lesson_row.id) filter(where case when lesson_row.lesson_type in ('text','video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent=100,false) when lesson_row.lesson_type='quiz' then exists(select 1 from public.quiz_lessons as quiz_row join public.quiz_attempts as attempt_row on attempt_row.quiz_id=quiz_row.id where quiz_row.lesson_id=lesson_row.id and attempt_row.enrollment_id=enrollment_row.id and attempt_row.passed) else false end)::integer into eligible_count,done_count from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' join public.course_modules as module_row on module_row.course_id=course_row.id join public.lessons as lesson_row on lesson_row.course_id=course_row.id and lesson_row.module_id=module_row.id and lesson_row.lesson_type in ('text','video','quiz') left join public.lesson_progress as progress_row on progress_row.enrollment_id=enrollment_row.id and progress_row.lesson_id=lesson_row.id where enrollment_row.learner_id=auth.uid() and enrollment_row.course_id=p_course_id and enrollment_row.status='completed' and enrollment_row.completed_at is not null; return query select coalesce(eligible_count,0)>0 and eligible_count=done_count,certificate_row.certificate_code,certificate_row.status from (select 1) as state_row left join public.certificates as certificate_row on certificate_row.learner_id=auth.uid() and certificate_row.course_id=p_course_id; end; $$;

-- Reuse the hardened issuance API but require the revised eligibility state.
create or replace function public.issue_own_learning_certificate(p_course_id bigint)
returns table (certificate_code text, certificate_status text, issued_at timestamptz)
language plpgsql security definer set search_path='' as $$ declare state_row record; own_enrollment_id bigint; generated_code text; begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; select enrollment_row.id into own_enrollment_id from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' where enrollment_row.learner_id=auth.uid() and enrollment_row.course_id=p_course_id and enrollment_row.status='completed' and enrollment_row.completed_at is not null for update of enrollment_row,course_row; if own_enrollment_id is null then raise exception 'This course is not eligible for a certificate' using errcode='42501'; end if; select * into state_row from public.get_own_learning_certificate_state(p_course_id);if not coalesce(state_row.is_eligible,false) then raise exception 'This course is not eligible for a certificate' using errcode='22023'; end if; generated_code:=upper(replace(gen_random_uuid()::text,'-','')); insert into public.certificates(learner_id,course_id,certificate_code,learner_name,course_title,instructor_name,completed_at,status) select auth.uid(),course_row.id,generated_code,learner_profile.full_name,course_row.title,instructor_profile.full_name,enrollment_row.completed_at,'issued' from public.learning_courses as course_row join public.enrollments as enrollment_row on enrollment_row.id=own_enrollment_id left join public.profiles as learner_profile on learner_profile.id=auth.uid() left join public.profiles as instructor_profile on instructor_profile.id=course_row.instructor_id where course_row.id=p_course_id and learner_profile.full_name is not null on conflict(learner_id,course_id) do nothing; return query select certificate_row.certificate_code,certificate_row.status,certificate_row.issued_at from public.certificates as certificate_row where certificate_row.learner_id=auth.uid() and certificate_row.course_id=p_course_id; end; $$;

revoke execute on function public.recompute_learning_enrollment_completion(bigint), public.validate_learning_course_quiz_readiness() from public, anon, authenticated;
revoke execute on function public.complete_own_enrolled_lesson(bigint,bigint), public.submit_own_quiz_attempt(text,bigint,jsonb), public.list_own_learning_course_experience(integer,integer), public.get_own_enrolled_learning_course_experience_by_slug(text), public.get_own_learning_certificate_state(bigint), public.issue_own_learning_certificate(bigint) from public, anon, authenticated;
grant execute on function public.complete_own_enrolled_lesson(bigint,bigint), public.submit_own_quiz_attempt(text,bigint,jsonb), public.list_own_learning_course_experience(integer,integer), public.get_own_enrolled_learning_course_experience_by_slug(text), public.get_own_learning_certificate_state(bigint), public.issue_own_learning_certificate(bigint) to authenticated;

do $$
declare
  function_name regprocedure;
  expected_outputs jsonb;
  actual_outputs jsonb;
  mismatch_row record;
begin
  foreach function_name in array array[
    'public.add_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)'::regprocedure,
    'public.update_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)'::regprocedure,
    'public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure,
    'public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure,
    'public.list_own_learning_course_experience(integer,integer)'::regprocedure,
    'public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure,
    'public.get_own_learning_certificate_state(bigint)'::regprocedure,
    'public.issue_own_learning_certificate(bigint)'::regprocedure
  ] loop
    if not exists (select 1 from pg_proc as procedure_row where procedure_row.oid = function_name and procedure_row.prosecdef and exists (select 1 from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value) where split_part(setting_row.setting_value, '=', 1) = 'search_path' and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = '')) then raise exception 'Quiz integration aborted: SECURITY DEFINER or search_path mismatch for %', function_name; end if;
    if has_function_privilege('public', function_name, 'EXECUTE') or has_function_privilege('anon', function_name, 'EXECUTE') or not has_function_privilege('authenticated', function_name, 'EXECUTE') then raise exception 'Quiz integration aborted: execute grant mismatch for %', function_name; end if;
  end loop;
  if has_function_privilege('public', 'public.recompute_learning_enrollment_completion(bigint)'::regprocedure, 'EXECUTE') or has_function_privilege('anon', 'public.recompute_learning_enrollment_completion(bigint)'::regprocedure, 'EXECUTE') or has_function_privilege('authenticated', 'public.recompute_learning_enrollment_completion(bigint)'::regprocedure, 'EXECUTE') or has_function_privilege('public', 'public.validate_learning_course_quiz_readiness()'::regprocedure, 'EXECUTE') or has_function_privilege('anon', 'public.validate_learning_course_quiz_readiness()'::regprocedure, 'EXECUTE') or has_function_privilege('authenticated', 'public.validate_learning_course_quiz_readiness()'::regprocedure, 'EXECUTE') then raise exception 'Quiz integration aborted: internal function is browser executable'; end if;
  if not exists (select 1 from pg_proc as procedure_row where procedure_row.oid = 'public.recompute_learning_enrollment_completion(bigint)'::regprocedure and procedure_row.prosecdef) then raise exception 'Quiz integration aborted: internal recompute security mismatch'; end if;
  if (select count(*) from pg_trigger as trigger_row where trigger_row.tgrelid = 'public.learning_courses'::regclass and trigger_row.tgname = 'learning_courses_quiz_readiness_before_submit' and not trigger_row.tgisinternal and (trigger_row.tgtype & 2) = 2 and (trigger_row.tgtype & 16) = 16 and (trigger_row.tgtype & 1) = 1 and trigger_row.tgfoid = 'public.validate_learning_course_quiz_readiness()'::regprocedure) <> 1 then raise exception 'Quiz integration aborted: quiz readiness trigger shape is unexpected'; end if;
  if exists (select 1 from pg_class as relation_row join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace where namespace_row.nspname = 'public' and relation_row.relname in ('quiz_lessons','quiz_questions','quiz_options','quiz_attempts','quiz_attempt_answers') and (has_table_privilege('anon', relation_row.oid, 'SELECT') or has_table_privilege('authenticated', relation_row.oid, 'SELECT'))) then raise exception 'Quiz integration aborted: assessment table data is browser readable'; end if;
  if has_column_privilege('anon', 'public.quiz_options', 'is_correct', 'SELECT') or has_column_privilege('authenticated', 'public.quiz_options', 'is_correct', 'SELECT') then raise exception 'Quiz integration aborted: correct-answer column is browser-readable'; end if;
  for mismatch_row in
    with expected_contracts(function_oid, output_names, output_types) as (
      values
      ('public.recompute_learning_enrollment_completion(bigint)'::regprocedure, array['completed_lessons','total_lessons','progress_percent','enrollment_status','enrollment_completed_at'], array['integer'::regtype,'integer'::regtype,'integer'::regtype,'text'::regtype,'timestamptz'::regtype]),
      ('public.add_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)'::regprocedure, array['lesson_id','lesson_position'], array['bigint'::regtype,'integer'::regtype]),
      ('public.update_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)'::regprocedure, array['lesson_id'], array['bigint'::regtype]),
      ('public.complete_own_enrolled_lesson(bigint,bigint)'::regprocedure, array['completed_lesson_id','completed_at','progress_percent'], array['bigint'::regtype,'timestamptz'::regtype,'integer'::regtype]),
      ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, array['attempt_id','submitted_at','score_percentage','passed','correct_answer_count','total_question_count'], array['bigint'::regtype,'timestamptz'::regtype,'integer'::regtype,'boolean'::regtype,'integer'::regtype,'integer'::regtype]),
      ('public.list_own_learning_course_experience(integer,integer)'::regprocedure, array['course_id','slug','title','summary','category','level','is_free','instructor_name','enrolled_at','enrollment_status','completed_lessons','total_lessons','progress_percent','resume_lesson_id'], array['bigint'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'boolean'::regtype,'text'::regtype,'timestamptz'::regtype,'text'::regtype,'integer'::regtype,'integer'::regtype,'integer'::regtype,'bigint'::regtype]),
      ('public.get_own_enrolled_learning_course_experience_by_slug(text)'::regprocedure, array['course_id','slug','course_title','summary','description','category','level','is_free','instructor_name','enrolled_at','enrollment_status','enrollment_completed_at','completed_lessons','total_lessons','progress_percent','resume_lesson_id','module_id','module_title','module_position','lesson_id','lesson_title','lesson_type','lesson_completed','is_preview'], array['bigint'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'text'::regtype,'boolean'::regtype,'text'::regtype,'timestamptz'::regtype,'text'::regtype,'timestamptz'::regtype,'integer'::regtype,'integer'::regtype,'integer'::regtype,'bigint'::regtype,'bigint'::regtype,'text'::regtype,'integer'::regtype,'bigint'::regtype,'text'::regtype,'text'::regtype,'boolean'::regtype,'boolean'::regtype]),
      ('public.get_own_learning_certificate_state(bigint)'::regprocedure, array['is_eligible','certificate_code','certificate_status'], array['boolean'::regtype,'text'::regtype,'text'::regtype]),
      ('public.issue_own_learning_certificate(bigint)'::regprocedure, array['certificate_code','certificate_status','issued_at'], array['text'::regtype,'text'::regtype,'timestamptz'::regtype])
    ), expected_outputs as (
      select expected_contracts.function_oid, expected_name.value::text as output_name, expected_type.value::oid as output_type, expected_name.ordinality::integer as output_position
      from expected_contracts cross join lateral unnest(expected_contracts.output_names) with ordinality as expected_name(value, ordinality) cross join lateral unnest(expected_contracts.output_types) with ordinality as expected_type(value, ordinality)
      where expected_name.ordinality = expected_type.ordinality
    ), actual_outputs as (
      select procedure_row.oid as function_oid, argument_row.argument_name::text as output_name, argument_row.argument_type as output_type, row_number() over (partition by procedure_row.oid order by argument_row.ordinality)::integer as output_position, argument_row.argument_mode as output_mode
      from pg_proc as procedure_row cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames) with ordinality as argument_row(argument_type, argument_mode, argument_name, ordinality)
      where procedure_row.oid in (select function_oid from expected_contracts) and argument_row.argument_mode in ('t'::"char", 'o'::"char")
    ) select coalesce(expected_outputs.function_oid, actual_outputs.function_oid) as function_oid, coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position, expected_outputs.output_name as expected_name, expected_outputs.output_type as expected_type, actual_outputs.output_name as actual_name, actual_outputs.output_type as actual_type, actual_outputs.output_mode as actual_mode from expected_outputs full join actual_outputs on actual_outputs.function_oid = expected_outputs.function_oid and actual_outputs.output_position = expected_outputs.output_position where expected_outputs.output_position is null or actual_outputs.output_position is null or expected_outputs.output_name <> actual_outputs.output_name or expected_outputs.output_type <> actual_outputs.output_type order by 1,2 limit 1
  loop
    raise exception 'Quiz integration aborted: return contract mismatch for %', mismatch_row.function_oid::regprocedure using detail = format('position %s: expected %s %s; actual %s %s (mode %s)', mismatch_row.output_position, coalesce(mismatch_row.expected_name,'<none>'), coalesce(format_type(mismatch_row.expected_type,null),'<none>'), coalesce(mismatch_row.actual_name,'<none>'), coalesce(format_type(mismatch_row.actual_type,null),'<none>'), coalesce(mismatch_row.actual_mode::text,'<none>'));
  end loop;
end;
$$;

commit;
